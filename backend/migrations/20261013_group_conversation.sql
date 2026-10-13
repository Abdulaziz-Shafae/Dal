-- Tested on isolated MySQL 8.4.11; never executed against production by this task.
-- Choose one creation path; see README.md. Do not run after Hibernate creates these tables.
-- Additive only: existing private messages, users, locations and meeting points are untouched.
CREATE TABLE group_messages (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  sender_id INT NOT NULL,
  content VARCHAR(1000) NOT NULL,
  client_message_id VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_group_message_sender_client UNIQUE (sender_id, client_message_id),
  INDEX idx_group_message_group_id (group_id, id),
  CONSTRAINT fk_group_message_group FOREIGN KEY (group_id) REFERENCES dal_groups(id),
  CONSTRAINT fk_group_message_sender FOREIGN KEY (sender_id) REFERENCES users(id)
);
CREATE TABLE group_message_reads (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  last_message_id INT NOT NULL DEFAULT 0,
  CONSTRAINT uk_group_message_read_member UNIQUE (group_id, user_id),
  CONSTRAINT fk_group_read_group FOREIGN KEY (group_id) REFERENCES dal_groups(id),
  CONSTRAINT fk_group_read_user FOREIGN KEY (user_id) REFERENCES users(id)
);
