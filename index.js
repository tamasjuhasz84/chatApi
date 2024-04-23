// workflow teszteléséhez komment
// importok
import { Sequelize, DataTypes, QueryTypes } from 'sequelize'
import express from 'express'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import cookie from 'cookie'
import log4js from 'log4js'
import amqp from 'amqplib/callback_api.js'

// constansok
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
})

const logger = log4js.getLogger()
log4js.configure({
  appenders: {
    app: { type: 'file', filename: 'app.log' }
  },
  categories: {
    default: {
      appenders: ['app'],
      level: 'debug'
    }
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PORT = process.env.PORT || 1024
const app = express()

const expressServer = app.listen(PORT, () => {
  console.log(`Az express szerver ezen a porton fut: ${PORT}`)
})

const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:5500', 'http://127.0.0.1:5500']
  }
})

const User = sequelize.define(
  'user',
  {
    name: DataTypes.TEXT,
    pw: DataTypes.INTEGER,
    mail: DataTypes.TEXT
  },
  {
    tableName: 'registredUsers',
    hooks: {
      beforeCreate: (user, options) => {
        /* eslint eqeqeq: "off" */
        if (user.name == 'Admin') {
          throw new Error('Admin user cannot be created')
        }
      },
      afterCreate: (user, options) => {
        logger.info('Sikeresen regisztrált felhasználó: ', user.name)
      }
    }
  }
)

const Conversations = sequelize.define(
  'conversations',
  {
    conversation: DataTypes.TEXT
  },
  {
    tableName: 'userConversations'
  }
)

// express szerverrel kapcsolatos
app.set('views', path.join(__dirname, '/views'))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(cookieParser())
app.use(bodyParser.urlencoded({ extended: true }))
app.use((req, res, next) => {
  if (req.query.errorMes === 'unauthozized') {
    res.locals.errorMes = 'Validation problem.'
  } else {
    res.locals.errorMes = ''
  }
  next()
})

// socket műveletek
io.on('connection', (socket) => {
  const cookies = cookie.parse(socket.handshake.headers.cookie)
  logger.info(
    `${cookies.username} nevű felhasználó ${socket.id} socketen kapcsolódott a beszélgetéshez!`
  )

  // mindenkinek küldi, ha valaki bekapcsolódik
  socket.broadcast.emit(
    'commonMessage',
    cookies.username + ' kapcsolódott a beszélgetéshez'
  )

  //  a beírt üzenetet hallgatja és visszaküldi a kliensnek a felhasználóval megspékelve
  socket.on('message', (data) => {
    (async () => {
      await Conversations.create({ conversation: `${cookies.username}: ${data}` })
    })()
    io.emit('message', `${cookies.username}: ${data}`)
  })

  // mindenkinek küldi, ha valaki kilép
  socket.on('disconnect', () => {
    socket.broadcast.emit(
      'commonMessage',
      cookies.username + ' kilépett a beszélgetésből!'
    )
  })

  // az írás aktivítást emitálja
  socket.on('activity', (name) => {
    socket.broadcast.emit('activity', cookies.username)
  })
})

// rabbitMQ változók
const rabbitUrl = 'amqp://localhost'
let rabbitMsg
const queue = 'task_queue'
const exchange = 'logs'

// rabbitMQ itt érkeztetem az api_requests queue-ban lévő üzeneteket
amqp.connect(rabbitUrl, function (error0, connection) {
  if (error0) {
    throw error0
  }
  // csatorna létrehozása
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1
    }
    // Csatorna deklarálása
    // a durable a sort állítja tartósra vagy sem. A tartós sor újraindítás esetén sem veszik el.
    channel.assertExchange(exchange, 'fanout', {
      durable: false
    })

    channel.assertQueue(queue, {
      durable: true
    })
    channel.prefetch(1)
    // a buffert fel kell dolgozni (toString, parse, stb...)
    channel.consume(queue, function (msg) {
      rabbitMsg = JSON.parse(msg.content)
      console.log(' Ez a sorból jön: ', rabbitMsg)
      setTimeout(function () {
        console.log(' Kézbesült!')
        channel.ack(msg)
      }, 10000)
    }, {
      // nincs visszaigazolás funkció kapcsolása
      noAck: false
    })
    channel.assertQueue('', {
      exclusive: true
    }, function (error2, q) {
      if (error2) {
        throw error2
      }
      channel.bindQueue(q.queue, exchange, '')

      channel.consume(q.queue, function (logMsg) {
        if (logMsg.content) {
          console.log(' Ez a logos cucc:', logMsg.content.toString())
        }
      }, {
        noAck: true
      })
    })
  })
})

// oldalak renderelése
app.get('/', (req, res) => {
  res.clearCookie('createUser')
  res.render('login', {
    createUser: req.cookies.createUser,
    loginError: req.cookies.loginError,
    possibleUsers: rabbitMsg
  })
})

app.post('/process_login', (req, res) => {
  const password = req.body.password
  const username = req.body.username;
  (async () => {
    const selectedPass = await sequelize.query(
      'SELECT pw FROM `registredUsers` WHERE name LIKE :search_name',
      {
        replacements: { search_name: username },
        type: QueryTypes.SELECT
      }
    )
    if (!selectedPass[0]) {
      res.cookie('loginError', 'Hibás jelszó vagy felhasználónév!')
      res.redirect('/')
      logger.warn(
        `Jogosulatlan belépési kísérlet a következő adatokkal: felhasználónév: ${username}, jelszó: ${password}`
      )
    } else {
      /* eslint eqeqeq: "off" */
      if (selectedPass[0].pw == password) {
        res.cookie('username', username)
        res.redirect('/index')
        logger.info(username, ' bejelentkezett!')
      } else {
        res.cookie('loginError', 'Hibás jelszó vagy felhasználónév!')
        res.redirect('/')
        logger.warn(
          `Jogosulatlan belépési kísérlet a következő adatokkal: felhasználónév: ${username}, jelszó: ${password}`
        )
      }
    }
  })()
})

app.get('/create', (req, res) => {
  res.clearCookie('loginError')
  res.render('create', {
    createUser: req.cookies.createUser
  })
  res.clearCookie('createUser')
})

app.post('/process_create', (req, res) => {
  const password = req.body.password
  const username = req.body.username
  const email = req.body.email;
  (async () => {
    const selectedUserName = await sequelize.query(
      'SELECT name FROM `registredUsers` WHERE name LIKE :search_name',
      {
        replacements: { search_name: username },
        type: QueryTypes.SELECT
      }
    )
    if (selectedUserName[0]) {
      res.cookie('createUser', username, { path: '/create' })
      res.redirect('/create')
    } else {
      await User.create({ name: username, pw: password, mail: email })
      res.cookie('createUser', username, { path: '/' })
      res.redirect('/')
    }
  })()
})

app.get('/index', (req, res) => {
  res.clearCookie('loginError');
  (async () => {
    const fullHistory = await sequelize.query('SELECT conversation FROM `userConversations`', { type: QueryTypes.SELECT })
    if (req.cookies.username) {
      res.render('index', {
        username: req.cookies.username,
        fullHistory
      })
    } else {
      res.redirect('/')
    }
  })()
})

// kilépést kezeli és törli a cookikat
app.get('/logout', (req, res) => {
  logger.info(req.cookies.username, ' kijelentkezett!')
  res.clearCookie('username')
  res.clearCookie('createUser')
  res.redirect('/')
})
