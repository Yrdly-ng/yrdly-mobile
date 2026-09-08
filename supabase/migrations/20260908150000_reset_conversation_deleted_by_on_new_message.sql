-- Reset deleted_by array on conversation when a new message is sent
CREATE OR REPLACE FUNCTION reset_conversation_deleted_by()
RETURNS trigger AS $$
BEGIN
  UPDATE conversations
  SET deleted_by = '{}'::text[],
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_reset_conversation_deleted_by ON messages;
CREATE TRIGGER tr_reset_conversation_deleted_by
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION reset_conversation_deleted_by();
