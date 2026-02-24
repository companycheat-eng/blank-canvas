
CREATE OR REPLACE FUNCTION public.on_kyc_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status_kyc = 'aprovado' AND (OLD.status_kyc IS DISTINCT FROM 'aprovado') THEN
    IF NOT EXISTS (
      SELECT 1 FROM wallet_ledger 
      WHERE motorista_id = NEW.id 
      AND motivo = 'Crédito Promocional'
    ) THEN
      UPDATE motoristas SET saldo_creditos = saldo_creditos + 50 WHERE id = NEW.id;
      INSERT INTO wallet_ledger (motorista_id, tipo, valor, motivo)
      VALUES (NEW.id, 'credito', 50, 'Crédito Promocional');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kyc_approved
AFTER UPDATE OF status_kyc ON public.motoristas
FOR EACH ROW
EXECUTE FUNCTION public.on_kyc_approved();
