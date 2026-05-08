from langgraph.graph import StateGraph, END
from pipeline.agents.state import AgentState
from pipeline.agents.research_agent import research_node
from pipeline.agents.signal_agent import signal_node
from pipeline.agents.enrichment_agent import enrichment_node
from pipeline.agents.scoring_agent import scoring_node
from pipeline.agents.outreach_agent import outreach_node

def should_loop_research(state: AgentState) -> str:
    """Loop back to research if we got fewer than 30 signals and haven't looped twice."""
    if len(state.get("signals", [])) < 30 and state.get("research_loop_count", 0) < 2:
        return "research"   # loop
    return "enrichment"     # proceed

def build_graph():
    g = StateGraph(AgentState)

    g.add_node("research", research_node)
    g.add_node("signal", signal_node)
    g.add_node("enrichment", enrichment_node)
    g.add_node("scoring", scoring_node)
    g.add_node("outreach", outreach_node)

    g.set_entry_point("research")
    g.add_edge("research", "signal")

    # Conditional: loop research if < 30 signals
    g.add_conditional_edges("signal", should_loop_research, {
        "research": "research",
        "enrichment": "enrichment",
    })

    g.add_edge("enrichment", "scoring")
    g.add_edge("scoring", "outreach")
    g.add_edge("outreach", END)

    return g.compile()