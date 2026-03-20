-- Add Q&A answers to Invites (JSON array of {question, answer} pairs)
ALTER TABLE Invites ADD COLUMN qa_answers TEXT;
