import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalysisRequest {
  analysisId: string;
  ticker: string;
  tradeDate: string;
  analysts: string[];
  llmProvider: string;
  deepThinkLlm: string;
  quickThinkLlm: string;
  researchDepth: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: AnalysisRequest = await req.json();
    const { analysisId, ticker, tradeDate, analysts, llmProvider, deepThinkLlm, quickThinkLlm, researchDepth } = body;

    if (!ticker || !tradeDate || !analysisId) {
      return new Response(JSON.stringify({ error: "Missing required fields: ticker, tradeDate, analysisId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to running
    await supabase
      .from("analyses")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", analysisId);

    // Build the Python analysis command
    const pythonScript = `
import sys
import json
sys.path.insert(0, '/tmp/cc-agent/66927234/project')

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

config = DEFAULT_CONFIG.copy()
config["llm_provider"] = ${JSON.stringify(llmProvider || "openai")}
config["deep_think_llm"] = ${JSON.stringify(deepThinkLlm || "o4-mini")}
config["quick_think_llm"] = ${JSON.stringify(quickThinkLlm || "gpt-4o-mini")}
config["max_debate_rounds"] = ${researchDepth || 1}
config["max_risk_discuss_rounds"] = ${researchDepth || 1}
config["online_tools"] = True

selected_analysts = ${JSON.stringify(analysts || ["market", "social", "news", "fundamentals"])}

ta = TradingAgentsGraph(selected_analysts, debug=False, config=config)
final_state, signal = ta.propagate(${JSON.stringify(ticker)}, ${JSON.stringify(tradeDate)})

result = {
    "signal": signal,
    "market_report": final_state.get("market_report", ""),
    "sentiment_report": final_state.get("sentiment_report", ""),
    "news_report": final_state.get("news_report", ""),
    "fundamentals_report": final_state.get("fundamentals_report", ""),
    "investment_plan": final_state.get("investment_plan", ""),
    "trader_investment_plan": final_state.get("trader_investment_plan", ""),
    "final_trade_decision": final_state.get("final_trade_decision", ""),
}

debate_state = final_state.get("investment_debate_state", {})
if debate_state:
    result["bull_history"] = debate_state.get("bull_history", "")
    result["bear_history"] = debate_state.get("bear_history", "")

risk_state = final_state.get("risk_debate_state", {})
if risk_state:
    result["risk_debate_history"] = risk_state.get("history", "")

print(json.dumps(result))
`;

    // Execute the Python script
    const command = new Deno.Command("python3", {
      args: ["-c", pythonScript],
      stdout: "piped",
      stderr: "piped",
      env: {
        ...Deno.env.toObject(),
        PYTHONPATH: "/tmp/cc-agent/66927234/project",
      },
    });

    const { stdout, stderr, code } = await command.output();

    if (code !== 0) {
      const errorMsg = new TextDecoder().decode(stderr);
      console.error("Python error:", errorMsg);

      await supabase
        .from("analyses")
        .update({
          status: "failed",
          error_message: errorMsg.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", analysisId);

      return new Response(JSON.stringify({ error: "Analysis failed", details: errorMsg.slice(0, 500) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const output = new TextDecoder().decode(stdout);
    const result = JSON.parse(output.trim().split("\n").pop()!);

    // Update the analysis record with results
    await supabase
      .from("analyses")
      .update({
        status: "completed",
        signal: result.signal,
        market_report: result.market_report,
        sentiment_report: result.sentiment_report,
        news_report: result.news_report,
        fundamentals_report: result.fundamentals_report,
        investment_plan: result.investment_plan,
        trader_investment_plan: result.trader_investment_plan,
        final_trade_decision: result.final_trade_decision,
        bull_history: result.bull_history,
        bear_history: result.bear_history,
        risk_debate_history: result.risk_debate_history,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);

    // Try to update the analysis status to failed
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if (body2.analysisId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from("analyses")
          .update({
            status: "failed",
            error_message: String(error).slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", body2.analysisId);
      }
    } catch {}

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
