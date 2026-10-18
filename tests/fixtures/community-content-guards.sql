-- Existing launch-security content guards, retained as a compatibility fixture.
CREATE OR REPLACE FUNCTION public.guard_community_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor_id uuid := auth.uid();
  is_mod boolean;
  post_community_id uuid;
BEGIN
  IF actor_id IS NULL THEN RETURN NEW; END IF;

  -- Counter updates made by trusted database triggers are not author edits.
  IF TG_TABLE_NAME = 'community_posts' AND TG_OP = 'UPDATE' THEN
    IF pg_trigger_depth() > 1 AND
       (to_jsonb(NEW) - ARRAY['comment_count', 'updated_at']) =
       (to_jsonb(OLD) - ARRAY['comment_count', 'updated_at']) THEN
      RETURN NEW;
    END IF;
    IF current_setting('yrdly.community_like_count_update', true) = 'on' AND
       (to_jsonb(NEW) - ARRAY['like_count', 'updated_at']) =
       (to_jsonb(OLD) - ARRAY['like_count', 'updated_at']) THEN
      RETURN NEW;
    END IF;
  END IF;

  is_mod := public.is_community_mod_or_admin(NEW.community_id, actor_id);

  IF TG_TABLE_NAME = 'community_comments' THEN
    SELECT community_id INTO post_community_id FROM public.community_posts WHERE id = NEW.post_id;
    IF post_community_id IS DISTINCT FROM NEW.community_id THEN
      RAISE EXCEPTION 'Comment must belong to its post community';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.author_id IS DISTINCT FROM actor_id THEN
      RAISE EXCEPTION 'Author must be the signed-in user';
    END IF;
    NEW.moderation_status := 'pending';
    NEW.created_at := now();
    IF TG_TABLE_NAME = 'community_posts' THEN
      NEW.is_pinned := false;
      NEW.like_count := 0;
      NEW.comment_count := 0;
    ELSE
      NEW.like_count := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'community_posts' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.community_id IS DISTINCT FROM OLD.community_id
       OR NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Post identity cannot be changed';
    END IF;
    IF NOT is_mod THEN
      IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
         OR NEW.like_count IS DISTINCT FROM OLD.like_count
         OR NEW.comment_count IS DISTINCT FROM OLD.comment_count
         OR NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
        RAISE EXCEPTION 'Only moderators may change post state';
      END IF;
      IF NEW.content IS DISTINCT FROM OLD.content
         OR NEW.image_urls IS DISTINCT FROM OLD.image_urls
         OR NEW.video_urls IS DISTINCT FROM OLD.video_urls THEN
        NEW.moderation_status := 'pending';
      END IF;
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.post_id IS DISTINCT FROM OLD.post_id
       OR NEW.community_id IS DISTINCT FROM OLD.community_id
       OR NEW.author_id IS DISTINCT FROM OLD.author_id
       OR NEW.parent_comment_id IS DISTINCT FROM OLD.parent_comment_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Comment identity cannot be changed';
    END IF;
    IF NOT is_mod THEN
      IF NEW.like_count IS DISTINCT FROM OLD.like_count
         OR NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
        RAISE EXCEPTION 'Only moderators may change comment state';
      END IF;
      IF NEW.content IS DISTINCT FROM OLD.content THEN
        NEW.moderation_status := 'pending';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_community_post ON public.community_posts;
CREATE TRIGGER tr_guard_community_post
BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.guard_community_content();

DROP TRIGGER IF EXISTS tr_guard_community_comment ON public.community_comments;
CREATE TRIGGER tr_guard_community_comment
BEFORE INSERT OR UPDATE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.guard_community_content();

-- The database queues every new community item, including direct API writes.
