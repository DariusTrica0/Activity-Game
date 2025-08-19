# 🎨 Activity Game

**Activity Game** este o aplicație web multiplayer ce reproduce mecanica clasicului joc **Activity**: jucătorii trebuie să **deseneze**, **descrie** sau să facă echipă pentru a ghici cuvintele într-un timp limitat.  
Proiectul folosește **FastAPI + SQLAlchemy (Python)** pentru backend și **HTML, CSS, JavaScript (vanilla)** pentru interfața client.

---

## 🚀 Funcționalități

- 🔑 Creare cont/joc nou sau alăturare la un joc existent  
- 👫 Creare și gestionare echipe (assign, unassign, swap)  
- 📝 Lobby de așteptare + afișare lista jucători  
- 🎮 Mecanici de joc:
  - Desene live pe canvas (pencil + gumă)  
  - Chat live și trimitere de răspunsuri  
  - Timer automat (90s) pentru fiecare rundă  
  - Atribuirea rândului și afișarea cuvântului doar jucătorului activ  
- 📊 Scoreboard în timp real pentru echipe  
- 🔌 Comunicare în timp real prin **WebSockets**  

---

## 🛠️ Tehnologii

### Backend (Python)
- **FastAPI** – framework web și API REST:contentReference[oaicite:0]{index=0}  
- **SQLAlchemy** – ORM pentru baze de date (modele: Game, Team, Player, Drawing):contentReference[oaicite:1]{index=1}  
- **SQLite** – stocare locală (`activity.db`):contentReference[oaicite:2]{index=2}  
- **WebSockets** – update-uri live (chat, desen, scoruri):contentReference[oaicite:3]{index=3}  

### Frontend
- **HTML + CSS** pentru UI:contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5}  
- **Vanilla JavaScript** pentru logica jocului: crearea jocurilor, conectare prin API și WebSocket, desen live:contentReference[oaicite:6]{index=6}  

---

## ⚙️ Instalare și rulare locală

### 1. Clonează repo-ul
```bash
git clone https://github.com/<user>/<repo>.git
cd ActivityGame
