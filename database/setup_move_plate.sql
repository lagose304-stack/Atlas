-- Preparación local: requiere revisión, respaldo y autorización antes de aplicar.
-- Operación atómica; conserva ID, URL, señalados, metadatos y secciones del mapa.
BEGIN;
CREATE OR REPLACE FUNCTION public.atlas_move_plate(
  p_placa_id integer, p_from_tema_id integer, p_from_subtema_id integer,
  p_tema_id integer, p_subtema_id integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_plate public.placas%ROWTYPE;
  v_map public.interactive_maps%ROWTYPE;
  v_order integer;
  v_number integer;
BEGIN
  IF NOT public.atlas_has_role(ARRAY['Administrador','Microscopía']) THEN
    RAISE EXCEPTION 'No tienes permiso para mover placas' USING ERRCODE = '42501';
  END IF;
  -- Serializar modificaciones del catálogo/mapas, incluidas las de otros editores.
  LOCK TABLE public.placas, public.interactive_maps IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO v_plate FROM public.placas WHERE id = p_placa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La placa ya no está disponible'; END IF;
  IF v_plate.tema_id IS DISTINCT FROM p_from_tema_id OR v_plate.subtema_id IS DISTINCT FROM p_from_subtema_id THEN
    RAISE EXCEPTION 'La ubicación cambió. Vuelve a seleccionar la placa';
  END IF;
  PERFORM 1 FROM public.temas WHERE id = p_tema_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El tema destino no existe'; END IF;
  PERFORM 1 FROM public.subtemas WHERE id = p_subtema_id AND tema_id = p_tema_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El subtema no pertenece al tema destino'; END IF;
  IF p_tema_id = v_plate.tema_id AND p_subtema_id = v_plate.subtema_id THEN
    RAISE EXCEPTION 'Selecciona una ubicación diferente';
  END IF;
  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_order FROM public.placas WHERE subtema_id = p_subtema_id;
  SELECT * INTO v_map FROM public.interactive_maps WHERE placa_id = p_placa_id FOR UPDATE;
  IF FOUND THEN
    v_number := v_map.map_number;
    IF EXISTS (SELECT 1 FROM public.interactive_maps WHERE tema_id = p_tema_id AND map_number = v_number AND id <> v_map.id) THEN
      SELECT COALESCE(MAX(map_number), 0) + 1 INTO v_number FROM public.interactive_maps WHERE tema_id = p_tema_id;
    END IF;
    UPDATE public.interactive_maps SET tema_id = p_tema_id, subtema_id = p_subtema_id, map_number = v_number WHERE id = v_map.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar el mapa'; END IF;
  END IF;
  UPDATE public.placas SET tema_id = p_tema_id, subtema_id = p_subtema_id, sort_order = v_order WHERE id = p_placa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar la placa'; END IF;
  RETURN jsonb_build_object('id', p_placa_id, 'tema_id', p_tema_id, 'subtema_id', p_subtema_id, 'map_id', v_map.id, 'map_number', v_number);
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_move_plate(integer,integer,integer,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_move_plate(integer,integer,integer,integer,integer) TO anon, authenticated;
COMMIT;
