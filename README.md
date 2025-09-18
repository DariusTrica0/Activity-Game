#  Activity Game

**Activity Game** is a multiplayer web application that recreates the mechanics of the classic **Activity** board game: players must **draw**, **describe**, or team up to guess words within a limited time.  
The project uses **FastAPI + SQLAlchemy (Python)** for the backend and **HTML, CSS, Vanilla JavaScript** for the client interface.

---

##  Features

-  Create account/new game or join an existing game  
-  Create and manage teams (assign, unassign, swap)  
- Waiting lobby + display of player list  
-  Game mechanics:
  - Live drawing on canvas (pencil + eraser)  
  - Live chat and answer submission  
  - Automatic timer (90s) for each round  
  - Turn assignment and word visibility only for the active player  
-  Real-time team scoreboard  
-  Real-time communication via **WebSockets**  

---

##  Technologies

### Backend (Python)
- **FastAPI** – web framework and REST API  
- **SQLAlchemy** – ORM for databases (models: Game, Team, Player, Drawing)  
- **SQLite** – local storage (`activity.db`)  
- **WebSockets** – live updates (chat, drawing, scores)  

### Frontend
- **HTML + CSS** for UI  
- **Vanilla JavaScript** for game logic: game creation, API & WebSocket connection, live drawing  

