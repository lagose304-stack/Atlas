-- Tabla para placas subidas sin clasificar (lista de espera)
CREATE TABLE IF NOT EXISTS placas_sin_clasificar (
  id          BIGSERIAL PRIMARY KEY,
  photo_url   TEXT NOT NULL,
  public_id   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
