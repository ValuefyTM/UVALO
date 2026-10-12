-- Colaborări: new posts in the person's zones are also sent by email (with a sign-in link to the post); 0 = in the app only.
ALTER TABLE collab_profiles ADD COLUMN email_notif INTEGER NOT NULL DEFAULT 1;
