from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Conexiune la baza 
DATABASE_URL = "sqlite:///./activity.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)