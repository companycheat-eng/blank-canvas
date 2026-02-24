
-- Add rating column to motoristas
ALTER TABLE public.motoristas ADD COLUMN nota_referencia numeric NOT NULL DEFAULT 5.0;

-- Function to recalculate driver rating based on cancellation ratio
CREATE OR REPLACE FUNCTION public.recalcular_nota_motorista(p_motorista_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER;
  v_finalizadas INTEGER;
  v_canceladas_motorista INTEGER;
  v_nota NUMERIC;
BEGIN
  -- Count completed rides
  SELECT COUNT(*) INTO v_finalizadas
  FROM corridas
  WHERE motorista_id = p_motorista_id AND status = 'finalizada';

  -- Count rides cancelled by the driver
  SELECT COUNT(*) INTO v_canceladas_motorista
  FROM corridas
  WHERE motorista_id = p_motorista_id AND status = 'cancelada' AND cancelado_por = 'motorista';

  v_total := v_finalizadas + v_canceladas_motorista;

  -- If no rides yet, keep default 5.0
  IF v_total = 0 THEN
    v_nota := 5.0;
  ELSE
    -- Formula: 5.0 * (1 - (cancellations * 1.5 / total))
    -- Each cancellation weighs 1.5x more than a completion
    -- Minimum 1.0
    v_nota := GREATEST(1.0, ROUND(5.0 * (1.0 - (v_canceladas_motorista::numeric * 1.5 / v_total::numeric)), 1));
  END IF;

  -- Update motorista
  UPDATE motoristas SET nota_referencia = v_nota WHERE id = p_motorista_id;

  RETURN v_nota;
END;
$function$;

-- Trigger function to auto-recalculate on corrida status change
CREATE OR REPLACE FUNCTION public.trigger_recalcular_nota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only recalculate when status changes to finalizada or cancelada
  IF NEW.status IN ('finalizada', 'cancelada') AND OLD.status != NEW.status AND NEW.motorista_id IS NOT NULL THEN
    PERFORM recalcular_nota_motorista(NEW.motorista_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger on corridas table
CREATE TRIGGER trg_recalcular_nota_motorista
AFTER UPDATE ON public.corridas
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalcular_nota();
