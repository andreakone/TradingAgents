/*
  # Create analyses table for TradingAgents web app

  1. New Tables
    - `analyses`
      - `id` (uuid, primary key)
      - `ticker` (text, stock ticker symbol)
      - `trade_date` (text, analysis date in YYYY-MM-DD format)
      - `analysts` (text[], selected analyst types)
      - `llm_provider` (text, LLM provider name)
      - `deep_think_llm` (text, deep thinking model name)
      - `quick_think_llm` (text, quick thinking model name)
      - `research_depth` (integer, number of debate rounds)
      - `status` (text, analysis status: pending/running/completed/failed)
      - `signal` (text, final trading signal: BUY/SELL/HOLD)
      - `market_report` (text, market analyst report)
      - `sentiment_report` (text, social media analyst report)
      - `news_report` (text, news analyst report)
      - `fundamentals_report` (text, fundamentals analyst report)
      - `investment_plan` (text, research team decision)
      - `trader_investment_plan` (text, trader's plan)
      - `final_trade_decision` (text, final risk management decision)
      - `bull_history` (text, bull researcher debate history)
      - `bear_history` (text, bear researcher debate history)
      - `risk_debate_history` (text, risk management debate history)
      - `error_message` (text, error details if failed)
      - `created_at` (timestamptz, creation timestamp)
      - `updated_at` (timestamptz, last update timestamp)

  2. Security
    - Enable RLS on `analyses` table
    - Add policy for authenticated users to manage their own analyses
    - Add policy for authenticated users to read all analyses
*/

CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  trade_date text NOT NULL,
  analysts text[] NOT NULL DEFAULT '{"market","social","news","fundamentals"}',
  llm_provider text NOT NULL DEFAULT 'openai',
  deep_think_llm text NOT NULL DEFAULT 'o4-mini',
  quick_think_llm text NOT NULL DEFAULT 'gpt-4o-mini',
  research_depth integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  signal text,
  market_report text,
  sentiment_report text,
  news_report text,
  fundamentals_report text,
  investment_plan text,
  trader_investment_plan text,
  final_trade_decision text,
  bull_history text,
  bear_history text,
  risk_debate_history text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all analyses"
  ON analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON analyses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON analyses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
