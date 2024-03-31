# chatApi

dev indítása: npm run dev
teszt indítása: npm run test

Login oldalon db-ből lehet belépéshez felhasználót kinézni, de az Új regisztráció funkció működik.
Új regisztrációnál minden mező kötelező, és csak a felhasználónév duplikációt nem engedi.
A chatszoba csak bejelentkezés után jelenik meg, és akkor lesz navbar, amiben a kijelentkezés is megjelenik.

Mindkét fél http://localhost:1024/-en kommunikál (sajátgépen két külön böngészőben), és a socket server a http://localhost:5500 megy.

database.sqlite:
Alap felhasználók definiálva vannak a registeredUsers táblában
A chat szoba minden beküldött üzenete a userConversations táblába kerül
Az index oldal renderelésekor betöltésre kerül az mentett beszélgetés

app.test.js-ben egyetlen minta teszt cóvan megírva

app.log-ban a főbb login események kerülnek logolásra

socket szerver figyeli: belépés, kilépés, üzenetküldés, írás aktivítás

oldalakat server rendereli (Embedded JavaScript)
