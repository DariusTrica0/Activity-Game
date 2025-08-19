from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()

# Enum-uri pentru status și tip rundă
class GameStatusEnum(str, enum.Enum):
    active = "active"
    finished = "finished"

class RoundType(str, enum.Enum):
    draw = "draw"
    describe = "describe"

# Modele SQLAlchemy
class Game(Base):
    __tablename__ = "games"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(Enum(GameStatusEnum), default=GameStatusEnum.active)
    current_turn_index = Column(Integer, default=0)
    current_word = Column(String, default=None)
    round_type = Column(Enum(RoundType), default=None)
    players = relationship("Player", back_populates="game")
    teams = relationship("Team", back_populates="game")
    drawing = relationship("Drawing", back_populates="game", uselist=False)

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    game_id = Column(Integer, ForeignKey("games.id"))
    players = relationship("Player", back_populates="team")
    game = relationship("Game", back_populates="teams")

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    score = Column(Integer, default=0)
    game_id = Column(Integer, ForeignKey("games.id"))
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    game = relationship("Game", back_populates="players")
    team = relationship("Team", back_populates="players")

class Drawing(Base):
    __tablename__ = "drawings"
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"))
    drawing_data = Column(Text)
    game = relationship("Game", back_populates="drawing")