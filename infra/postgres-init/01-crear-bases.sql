-- Solo corre la primera vez (volumen vacío). Para rehacer: docker compose down -v
CREATE DATABASE muni_san_bartolo;
CREATE DATABASE muni_demo;

\connect muni_san_bartolo
CREATE EXTENSION IF NOT EXISTS vector;

\connect muni_demo
CREATE EXTENSION IF NOT EXISTS vector;
