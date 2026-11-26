from __future__ import annotations

from collections.abc import Generator

from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 declarative base."""


def _create_db_engine(database_url: str | None = None):
    url = database_url or get_settings().database_url
    connect_args: dict = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if url.startswith("sqlite:///"):
            db_file_str = url.removeprefix("sqlite:///")
            if db_file_str and db_file_str != ":memory:":
                db_parent = Path(db_file_str).parent
                if str(db_parent) not in {"", "."}:
                    db_parent.mkdir(parents=True, exist_ok=True)

    eng = create_engine(url, connect_args=connect_args, future=True)

    if url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def _set_sqlite_pragmas(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            # WAL improves concurrent reads (UI polling) while background workers write
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA busy_timeout=5000;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()

    return eng


engine = _create_db_engine()
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def init_db(target_engine=None) -> None:
    """Create all tables if they do not exist."""
    from backend import models  # noqa: F401 - register ORM models

    Base.metadata.create_all(bind=target_engine or engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
