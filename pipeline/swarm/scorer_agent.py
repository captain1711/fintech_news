class ScorerAgent:
    """
    Advanced Scorer Agent: Multi-factor scoring with signal quality & recency.
    """
    def __init__(self):
        self.name = "scorer"
        
        # Signal type importance (regulatory deadline = must-buy)
        self.signal_weights = {
            "regulatory_deadline": 50,    # Highest (mandatory compliance)
            "hiring_engineers": 45,       # High (they're building NOW)
            "fresh_funding": 40,          # High (budget approved)
            "strategic_move": 25,         # Medium (planning phase)
            "competitive_threat": 35,     # High (urgency from competition)
            "product_launch": 20,         # Low (might not need fintech)
        }
        
        # Organization type multiplier (FIXED: banks are high priority)
        self.org_multipliers = {
            "bank": 1.2,                  # Highest (banks need infrastructure)
            "fintech": 1.1,               # High (fintech need scale)
            "payment_provider": 1.15,     # Very high (payments focus)
            "nbfc": 1.0,                  # Medium
            "startup": 0.85,              # Lower (might not have budget)
            "unknown": 0.5,               # Avoid
        }
        
        # Bank size matters (bigger banks = bigger budgets)
        self.bank_size_multipliers = {
            "large": 1.3,                 # ₹10,000Cr+
            "mid": 1.1,                   # ₹1,000-10,000Cr
            "small": 0.9,                 # <₹1,000Cr
        }

    def calculate_signal_score(self, signal: dict) -> float:
        """
        Score a single signal based on type, recency, confidence.
        Returns 0-100.
        """
        
        signal_type = (
            signal.get("type")
            or signal.get("event_type")
            or "strategic_move"
        ).lower()
        if signal_type == "regulatory":
            signal_type = "regulatory_deadline"
        if signal_type == "strategic":
            signal_type = "strategic_move"
        base_pts = self.signal_weights.get(signal_type, 20)
        
        # Recency decay: -2% per day
        days_old = signal.get("days_old", 0)
        recency_decay = max(0.3, 1.0 - (days_old * 0.02))  # Min 30% at day 35
        
        # Confidence multiplier
        confidence = signal.get("confidence", 0.8)  # 0-1
        
        # Calculate
        score = base_pts * recency_decay * confidence
        
        return min(score, 100)

    def calculate_convergence_bonus(self, signals: list) -> float:
        """
        Bonus for multiple signals (convergence = higher confidence).
        
        Logic:
        - 1 signal: +0 bonus
        - 2 signals: +10% bonus
        - 3 signals: +20% bonus
        - 4+ signals: +30% bonus (capped)
        """
        
        signal_count = len(signals)
        
        if signal_count == 1:
            return 0
        elif signal_count == 2:
            return 10
        elif signal_count == 3:
            return 20
        else:  # 4+
            return 30

    def calculate_regulatory_urgency(self, signals: list) -> float:
        """
        If there's a regulatory deadline, add URGENCY multiplier.
        
        - Deadline < 30 days: +30 points (CRITICAL)
        - Deadline < 90 days: +20 points (HIGH)
        - Deadline < 180 days: +10 points (MEDIUM)
        """
        
        for signal in signals:
            signal_type = (
                signal.get("type")
                or signal.get("event_type")
                or ""
            ).lower()
            if signal_type in {"regulatory_deadline", "regulatory"}:
                deadline_days = signal.get("deadline_days", 0)
                
                if deadline_days < 30:
                    return 30
                elif deadline_days < 90:
                    return 20
                elif deadline_days < 180:
                    return 10
        
        return 0

    def work(self, state: dict) -> dict:
        """
        Main scoring logic.
        """
        accounts = state.get("accounts", {})
        scored = []

        for company_name, account_data in accounts.items():
            signals = account_data.get("signals", [])
            org_type = account_data.get("organization_type", "unknown").lower()
            bank_size = account_data.get("bank_size", "small")  # For banks
            
            # Step 1: Score each signal
            signal_scores = [self.calculate_signal_score(s) for s in signals]
            
            # Step 2: Average of signal scores
            base_score = sum(signal_scores) / len(signal_scores) if signal_scores else 0
            
            # Step 3: Convergence bonus (multiple signals = higher confidence)
            convergence_bonus = self.calculate_convergence_bonus(signals)
            
            # Step 4: Regulatory urgency bonus (if deadline is near)
            urgency_bonus = self.calculate_regulatory_urgency(signals)
            
            # Step 5: Organization type multiplier
            org_mult = self.org_multipliers.get(org_type, 0.5)
            
            # Step 6: Bank size multiplier (if bank)
            size_mult = 1.0
            if org_type == "bank":
                size_mult = self.bank_size_multipliers.get(bank_size, 0.9)
            
            # Step 7: Final calculation
            final_score = (base_score + convergence_bonus + urgency_bonus) * org_mult * size_mult
            final_score = min(round(final_score, 1), 100)  # Cap at 100
            
            account_data["final_score"] = final_score
            account_data["signal_count"] = len(signals)
            account_data["scoring_breakdown"] = {
                "base_signal_score": round(base_score, 1),
                "convergence_bonus": convergence_bonus,
                "urgency_bonus": urgency_bonus,
                "org_multiplier": org_mult,
                "size_multiplier": size_mult,
            }
            
            scored.append(account_data)

        # Sort by final score (descending)
        final_scored = sorted(scored, key=lambda x: x["final_score"], reverse=True)
        
        return {
            "scored": final_scored,
            "messages": [
                f"[Scorer] Evaluated {len(final_scored)} accounts",
                f"[Scorer] Top prospect: {final_scored[0]['company']} (Score: {final_scored[0]['final_score']})",
                f"[Scorer] Scoring factors: signal quality, recency, convergence, regulatory urgency, org type"
            ]
        }
