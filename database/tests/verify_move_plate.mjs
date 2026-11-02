// Ejecutar solo con PGlite aislado: node database/tests/verify_move_plate.mjs <ruta a pglite/dist/index.js>
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE temas(id integer PRIMARY KEY);
    CREATE TABLE subtemas(id integer PRIMARY KEY, tema_id integer REFERENCES temas);
    CREATE TABLE placas(id integer PRIMARY KEY, tema_id integer REFERENCES temas, subtema_id integer REFERENCES subtemas, sort_order integer, photo_url text, senalados text[], senalados_meta jsonb);
    CREATE TABLE interactive_maps(id integer PRIMARY KEY, placa_id integer UNIQUE REFERENCES placas, tema_id integer REFERENCES temas, subtema_id integer REFERENCES subtemas, map_number integer, sections jsonb, UNIQUE(tema_id,map_number));
    CREATE FUNCTION atlas_has_role(text[]) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('atlas.test_editor',true) = 'yes' $$;
    GRANT USAGE ON SCHEMA public TO anon;
    GRANT SELECT,UPDATE ON ALL TABLES IN SCHEMA public TO anon;
    INSERT INTO temas VALUES (1),(2);
    INSERT INTO subtemas VALUES (10,1),(20,2),(21,2);
    INSERT INTO placas VALUES (7,1,10,0,'imagen-original',ARRAY['señalado'],'[{"x":0.5}]'),(8,2,20,5,'otra',NULL,NULL),(9,1,10,1,'sin-mapa',NULL,NULL);
    INSERT INTO interactive_maps VALUES (70,7,1,10,1,'[{"nombre":"intacto"}]'),(80,8,2,20,1,'[]');
  `);
  await db.exec(await readFile(new URL('../setup_move_plate.sql', import.meta.url), 'utf8'));
  await db.exec("SET ROLE anon; SET atlas.test_editor='no'");
  await assert.rejects(db.query('select atlas_move_plate(7,1,10,2,20)'), /permiso/);
  await db.exec("SET atlas.test_editor='yes'");
  await assert.rejects(db.query('select atlas_move_plate(7,1,10,1,20)'), /no pertenece/);
  await assert.rejects(db.query('select atlas_move_plate(7,2,20,2,21)'), /ubicación cambió/);
  await assert.rejects(db.query('select atlas_move_plate(7,1,10,1,10)'), /diferente/);
  const before = (await db.query('select * from placas where id=7')).rows[0];
  await db.query('select atlas_move_plate(7,1,10,2,20)');
  const after = (await db.query('select * from placas where id=7')).rows[0];
  assert.deepEqual(after, { ...before, tema_id: 2, subtema_id: 20, sort_order: 6 });
  assert.deepEqual((await db.query('select * from interactive_maps where id=70')).rows[0], { id:70, placa_id:7, tema_id:2, subtema_id:20, map_number:2, sections:[{nombre:'intacto'}] });
  await db.query('select atlas_move_plate(7,2,20,2,21)');
  assert.equal((await db.query('select map_number from interactive_maps where id=70')).rows[0].map_number,2);
  await db.query('select atlas_move_plate(9,1,10,2,20)');
  assert.equal((await db.query('select count(*)::integer as n from interactive_maps')).rows[0].n,2);
  // Si la actualización de la placa falla después de actualizar el mapa, todo retrocede.
  await db.exec(`RESET ROLE; CREATE FUNCTION fail_plate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo simulado'; END $$;
    CREATE TRIGGER fail_plate BEFORE UPDATE ON placas FOR EACH ROW EXECUTE FUNCTION fail_plate(); SET ROLE anon;`);
  const mapBefore = (await db.query('select * from interactive_maps where id=70')).rows[0];
  await assert.rejects(db.query('select atlas_move_plate(7,2,21,1,10)'), /fallo simulado/);
  assert.deepEqual((await db.query('select * from interactive_maps where id=70')).rows[0],mapBefore);
  assert.equal((await db.query('select subtema_id from placas where id=7')).rows[0].subtema_id,21);
  console.log('SQL aislado: permisos, destino, concurrencia de origen, identidad, señalados, mapas, numeración, orden y rollback comprobados.');
} finally { await db.close(); }
