#!/usr/bin/env python3
"""
chat.py — Claude.ai alternative with full token management.

Features:
  - Adaptive thinking (Opus 4.6)
  - Prompt caching on system prompt
  - Token counting before each request
  - Cost estimation per message and session total
  - Conversation history
  - Budget warnings and hard cap
  - Token usage breakdown after every response

Usage:
  python chat.py
  python chat.py --budget 50000       # max input tokens per session
  python chat.py --effort max         # effort level: low|medium|high|max
  python chat.py --no-thinking        # disable extended thinking
  python chat.py --system "..."       # custom system prompt
"""

import argparse
import os
import sys

import anthropic

# ── Pricing (USD per 1M tokens) ──────────────────────────────────────────────
MODEL = "claude-opus-4-6"
PRICE = {
    "input":        5.00,
    "output":       25.00,
    "cache_write":  6.25,   # 1.25 × input
    "cache_read":   0.50,   # 0.10 × input
}

DEFAULT_SYSTEM = (
    "You are a helpful, precise assistant. "
    "Think carefully before answering complex questions."
)

# ── Cost helpers ─────────────────────────────────────────────────────────────

def cost(input_tok=0, output_tok=0, cache_write_tok=0, cache_read_tok=0) -> float:
    return (
        input_tok       * PRICE["input"]       / 1_000_000
        + output_tok    * PRICE["output"]      / 1_000_000
        + cache_write_tok * PRICE["cache_write"] / 1_000_000
        + cache_read_tok  * PRICE["cache_read"]  / 1_000_000
    )


def fmt_cost(usd: float) -> str:
    if usd < 0.001:
        return f"~${usd * 1000:.3f}m"   # milli-dollars
    return f"${usd:.4f}"


def fmt_tokens(n: int) -> str:
    if n >= 1_000:
        return f"{n/1_000:.1f}k"
    return str(n)


# ── Session state ─────────────────────────────────────────────────────────────

class Session:
    def __init__(self, system: str, budget: int, effort: str, thinking: bool):
        self.client = anthropic.Anthropic()
        self.system = system
        self.budget = budget          # max cumulative input tokens (0 = unlimited)
        self.effort = effort
        self.thinking = thinking
        self.messages: list[dict] = []

        # Cumulative counters
        self.total_input = 0
        self.total_output = 0
        self.total_cache_write = 0
        self.total_cache_read = 0
        self.total_cost = 0.0
        self.turns = 0

    # ── Pre-flight token count ────────────────────────────────────────────────

    def count_tokens(self, new_user_message: str) -> int:
        """Count tokens for the next request (before sending)."""
        pending = self.messages + [{"role": "user", "content": new_user_message}]
        result = self.client.messages.count_tokens(
            model=MODEL,
            system=[{
                "type": "text",
                "text": self.system,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=pending,
        )
        return result.input_tokens

    # ── Send a turn ───────────────────────────────────────────────────────────

    def chat(self, user_message: str) -> None:
        # 1. Count tokens before sending
        estimated_input = self.count_tokens(user_message)
        est_cost = cost(input_tok=estimated_input)
        print(f"\n  ┌─ pre-flight: ~{fmt_tokens(estimated_input)} input tokens "
              f"({fmt_cost(est_cost)} est.) ─")

        # 2. Budget check
        if self.budget and (self.total_input + estimated_input) > self.budget:
            used = self.total_input
            print(f"  │  ⚠  Budget cap: {fmt_tokens(used)} used + "
                  f"{fmt_tokens(estimated_input)} new > {fmt_tokens(self.budget)} limit.")
            answer = input("  │  Continue anyway? [y/N] ").strip().lower()
            if answer != "y":
                print("  └─ Request cancelled.\n")
                return

        # 3. Append user turn
        self.messages.append({"role": "user", "content": user_message})

        # 4. Build params
        params: dict = {
            "model": MODEL,
            "max_tokens": 16_000,
            "system": [{
                "type": "text",
                "text": self.system,
                "cache_control": {"type": "ephemeral"},
            }],
            "messages": self.messages,
        }
        if self.thinking:
            params["thinking"] = {"type": "adaptive"}
        params["output_config"] = {"effort": self.effort}

        # 5. Stream the response
        print("  └─────────────────────────────────────────────────\n")
        full_content = []
        usage = None

        with self.client.messages.stream(**params) as stream:
            in_thinking = False
            for event in stream:
                if event.type == "content_block_start":
                    if event.content_block.type == "thinking":
                        in_thinking = True
                        print("\033[2m[thinking]\033[0m", flush=True)
                    elif event.content_block.type == "text":
                        if in_thinking:
                            print()   # blank line after thinking
                        in_thinking = False

                elif event.type == "content_block_delta":
                    if event.delta.type == "thinking_delta":
                        print(f"\033[2m{event.delta.thinking}\033[0m",
                              end="", flush=True)
                    elif event.delta.type == "text_delta":
                        print(event.delta.text, end="", flush=True)

                elif event.type == "content_block_stop":
                    pass

            final = stream.get_final_message()
            full_content = final.content
            usage = final.usage

        print("\n")

        # 6. Append assistant turn (full content blocks for caching)
        self.messages.append({"role": "assistant", "content": full_content})

        # 7. Update counters
        inp      = usage.input_tokens
        out      = usage.output_tokens
        c_write  = getattr(usage, "cache_creation_input_tokens", 0) or 0
        c_read   = getattr(usage, "cache_read_input_tokens", 0) or 0
        turn_cost = cost(inp, out, c_write, c_read)

        self.total_input       += inp
        self.total_output      += out
        self.total_cache_write += c_write
        self.total_cache_read  += c_read
        self.total_cost        += turn_cost
        self.turns             += 1

        # 8. Token usage report
        cache_hit_pct = (c_read / (c_read + inp) * 100) if (c_read + inp) else 0
        print(
            f"  ╔═ turn #{self.turns} usage ═══════════════════════════════════╗\n"
            f"  ║  input:       {fmt_tokens(inp):>8}  "
            f"cache write: {fmt_tokens(c_write):>8}                 ║\n"
            f"  ║  output:      {fmt_tokens(out):>8}  "
            f"cache read:  {fmt_tokens(c_read):>8}  "
            f"({cache_hit_pct:.0f}% hit)  ║\n"
            f"  ║  turn cost:   {fmt_cost(turn_cost):>10}                                ║\n"
            f"  ║  session total: {fmt_cost(self.total_cost):>10}  "
            f"over {self.turns} turn(s)              ║\n"
            f"  ╚═══════════════════════════════════════════════════╝\n"
        )

    # ── Session summary ───────────────────────────────────────────────────────

    def summary(self) -> None:
        print(
            "\n  ╔═ session summary ══════════════════════════════════╗\n"
            f"  ║  turns:         {self.turns}\n"
            f"  ║  total input:   {fmt_tokens(self.total_input)}\n"
            f"  ║  total output:  {fmt_tokens(self.total_output)}\n"
            f"  ║  cache writes:  {fmt_tokens(self.total_cache_write)}\n"
            f"  ║  cache reads:   {fmt_tokens(self.total_cache_read)}\n"
            f"  ║  total cost:    {fmt_cost(self.total_cost)}\n"
            "  ╚═══════════════════════════════════════════════════╝\n"
        )


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Claude chat with full token management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--budget", type=int, default=0, metavar="TOKENS",
        help="Warn (and ask) when cumulative input exceeds this (0 = unlimited)",
    )
    p.add_argument(
        "--effort", choices=["low", "medium", "high", "max"], default="high",
        help="Thinking effort level (default: high)",
    )
    p.add_argument(
        "--no-thinking", dest="thinking", action="store_false", default=True,
        help="Disable extended thinking",
    )
    p.add_argument(
        "--system", default=DEFAULT_SYSTEM,
        help="System prompt (default: built-in)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    session = Session(
        system=args.system,
        budget=args.budget,
        effort=args.effort,
        thinking=args.thinking,
    )

    print(
        f"\n  Claude {MODEL}  |  effort={args.effort}  |  "
        f"thinking={'on' if args.thinking else 'off'}  |  "
        f"budget={'unlimited' if not args.budget else fmt_tokens(args.budget)}\n"
        "  Type your message. Commands: /clear /budget /stats /quit\n"
        "  ─────────────────────────────────────────────────────────"
    )

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user_input:
            continue

        # Slash commands
        if user_input == "/quit":
            break
        elif user_input == "/clear":
            session.messages.clear()
            print("  [history cleared]")
            continue
        elif user_input == "/stats":
            session.summary()
            continue
        elif user_input.startswith("/budget"):
            parts = user_input.split()
            if len(parts) == 2 and parts[1].isdigit():
                session.budget = int(parts[1])
                print(f"  [budget set to {fmt_tokens(session.budget)} tokens]")
            else:
                print(f"  [current budget: "
                      f"{'unlimited' if not session.budget else fmt_tokens(session.budget)}]")
            continue

        session.chat(user_input)

    session.summary()


if __name__ == "__main__":
    main()
