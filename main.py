from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
import logging
import asyncio
from json import loads
import re
import unicodedata

from database import engine, SessionLocal
from modules import Base, GameStatusEnum, RoundType, Game, Team, Player, Drawing

tags_metadata = [
    {
        "name": "Games",
        "description": "Operațiuni pentru gestionarea jocurilor (create, read, update, delete)."
    },
    {
        "name": "Players",
        "description": "Operațiuni pentru gestionarea jucătorilor (create, read, update, delete)."
    },
    {
        "name": "Teams",
        "description": "Operațiuni pentru gestionarea echipelor (create, read, update, delete)."
    },
    {
        "name": "Drawings",
        "description": "Operațiuni pentru gestionarea desenelor (create, read, delete)."
    }
]

# Creare tabele în DB
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Activity Game API",
    version="1.0.0",
    description="API pentru gestionarea unui joc Activity (Games, Players, Teams, Drawings) și operațiuni CRUD complete.",
    openapi_tags=tags_metadata
)

# (Opțional) Configurare CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pentru gestionarea task-urilor de timeout
timer_tasks: dict[int, asyncio.Task] = {}

# ─── Connection Manager ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, game_id: int):
        await websocket.accept()
        if game_id not in self.connections:
            self.connections[game_id] = []
        self.connections[game_id].append(websocket)

    def disconnect(self, websocket: WebSocket, game_id: int):
        if game_id in self.connections:
            self.connections[game_id].remove(websocket)

    async def broadcast(self, game_id: int, message: dict):
        if game_id in self.connections:
            for conn in self.connections[game_id]:
                await conn.send_json(message)

manager = ConnectionManager()

# ─── Dependență pentru DB ─────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── Modele Pydantic ──────────────────────────────────────────────────────────
class CreateGameRequest(BaseModel):
    name: str

class CreateGameResponse(BaseModel):
    gameId: int

class UpdateGameRequest(BaseModel):
    name: str | None = None
    status: GameStatusEnum | None = None

class CreatePlayerRequest(BaseModel):
    name: str

class CreatePlayerResponse(BaseModel):
    playerId: int    

class UpdatePlayerRequest(BaseModel):
    playerName: str | None = None
    score: int | None = None
    teamId: int | None = None

class CreateTeamRequest(BaseModel):
    name: str

class CreateTeamResponse(BaseModel):
    teamId: int

class AssignPlayerRequest(BaseModel):
    playerId: int
    teamId: int

class SaveDrawingRequest(BaseModel):
    drawingData: str

class FinishGameResponse(BaseModel):
    winner: dict

class GuessRequest(BaseModel):
    playerId: int
    guess: str

# ─── Endpoint-uri Games ───────────────────────────────────────────────────────
@app.post("/api/games", response_model=CreateGameResponse, status_code=201, tags=["Games"])
def create_game(request: CreateGameRequest, db: Session = Depends(get_db)):
    game = Game(name=request.name)
    db.add(game)
    db.commit()
    db.refresh(game)
    return {"gameId": game.id}

@app.get("/api/games/{game_id}", response_model=CreateGameResponse, tags=["Games"])
def get_game(game_id: int, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Jocul nu a fost găsit")
    return {"gameId": game.id}

@app.put("/api/games/{game_id}", response_model=CreateGameResponse, tags=["Games"])
def update_game(game_id: int, request: UpdateGameRequest, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Jocul nu a fost găsit")
    if request.name is not None:
        game.name = request.name
    if request.status is not None:
        game.status = request.status
    db.commit()
    db.refresh(game)
    return {"gameId": game.id}

@app.delete("/api/games/{game_id}", status_code=204, tags=["Games"])
def delete_game(game_id: int, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Jocul nu a fost găsit")
    db.delete(game)
    db.commit()

# ─── Endpoint-uri Players ─────────────────────────────────────────────────────
@app.post("/api/games/{game_id}/players", response_model=CreatePlayerResponse, status_code=201, tags=["Players"])
def create_player(game_id: int, request: CreatePlayerRequest, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Jocul nu a fost găsit")
    player = Player(name=request.name, game_id=game_id)
    db.add(player)
    db.commit()
    db.refresh(player)
    return {"playerId": player.id}

@app.get("/api/games/{game_id}/players", tags=["Players"])
def list_players(game_id: int, db: Session = Depends(get_db)):
    players = db.query(Player).filter(Player.game_id == game_id).all()
    return {"players": [{"id": p.id, "name": p.name, "score": p.score, "teamId": p.team_id} for p in players]}

@app.put("/api/players/{player_id}", tags=["Players"])
def update_player(player_id: int, request: UpdatePlayerRequest, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jucătorul nu a fost găsit")
    if request.playerName is not None:
        player.name = request.playerName
    if request.score is not None:
        player.score = request.score
    if request.teamId is not None:
        player.team_id = request.teamId
    db.commit()
    db.refresh(player)
    return {"message": "Jucător actualizat cu succes", "playerId": player.id}

@app.delete("/api/players/{player_id}", tags=["Players"])
def delete_player(player_id: int, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jucătorul nu a fost găsit")
    db.delete(player)
    db.commit()
    return {"message": f"Jucătorul cu ID {player_id} a fost șters cu succes"}

# ─── Endpoint-uri Teams ───────────────────────────────────────────────────────
@app.post("/api/games/{game_id}/teams", response_model=CreateTeamResponse, status_code=201, tags=["Teams"])
def create_team(game_id: int, request: CreateTeamRequest, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Jocul nu a fost găsit")
    team = Team(name=request.name, game_id=game_id)
    db.add(team)
    db.commit()
    db.refresh(team)
    return {"teamId": team.id}

@app.post("/api/games/{game_id}/assign_player", tags=["Teams"])
def assign_player(game_id: int, request: AssignPlayerRequest, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == request.teamId, Team.game_id == game_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Echipa nu a fost găsită în acest joc")
    player = db.query(Player).filter(Player.id == request.playerId, Player.game_id == game_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jucătorul nu a fost găsit în acest joc")
    player.team_id = team.id
    db.commit()
    return {"message": "Jucătorul a fost asignat echipei cu succes"}

@app.delete("/api/teams/{team_id}", tags=["Teams"])
def delete_team(team_id: int, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Echipa nu a fost găsită")
    db.delete(team)
    db.commit()
    return {"message": f"Echipa cu ID {team_id} a fost ștearsă cu succes"}

# ─── Endpoint-uri Drawings ────────────────────────────────────────────────────
@app.post("/api/games/{game_id}/drawing", tags=["Drawings"])
def save_drawing(game_id: int, request: SaveDrawingRequest, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Jocul nu a fost găsit")
    drawing = db.query(Drawing).filter(Drawing.game_id == game_id).first()
    if drawing:
        drawing.drawing_data = request.drawingData
    else:
        drawing = Drawing(game_id=game_id, drawing_data=request.drawingData)
        db.add(drawing)
    db.commit()
    return {"message": "Desen salvat cu succes"}

# ─── WebSocket pentru joc ─────────────────────────────────────────────────────
@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: int):
    await manager.connect(websocket, game_id)
    try:
        while True:
            raw = await websocket.receive_text()
            message = loads(raw)
            # Gestionează diferite tipuri de mesaje: chat, drawing, guess, end_round…
            if message.get("action") == "guess":
                # (logica de procesare a ghicitului, similară celei din codul original)
                ...
            elif message.get("action") == "end_round":
                # (întrerupe timer și anunță sfârșitul rundei)
                ...
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)
        await manager.broadcast(game_id, {
            "type": "disconnect",
            "message": f"Un client s-a deconectat din jocul {game_id}"
        })

# ─── Funcție pentru timer automat ─────────────────────────────────────────────
async def timer_end_turn(game_id: int):
    try:
        await asyncio.sleep(90)
        await manager.broadcast(game_id, {"type": "end_turn"})
    except asyncio.CancelledError:
        pass
