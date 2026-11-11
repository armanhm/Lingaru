"""Shared helpers for Telegram handlers: HTML escaping and long-reply chunking."""

import html

from telegram.constants import MessageLimit, ParseMode

MAX_LEN = MessageLimit.MAX_TEXT_LENGTH
HTML = ParseMode.HTML


def esc(value) -> str:
    """Escape untrusted text (LLM output, RSS titles, user input) for ParseMode.HTML."""
    return html.escape(str(value), quote=False)


def esc_attr(value) -> str:
    """Escape text for use inside a double-quoted HTML attribute such as href."""
    return html.escape(str(value), quote=True)


def italic(text: str) -> str:
    """Wrap text in <i>, one tag pair per line so chunking never splits a tag."""
    return "\n".join(f"<i>{esc(line)}</i>" if line.strip() else line for line in text.split("\n"))


def chunk_text(text: str, limit: int = MAX_LEN) -> list[str]:
    """Split text into pieces of at most `limit` chars, preferring line boundaries."""
    chunks: list[str] = []
    current = ""
    for line in text.split("\n"):
        # A single line longer than the limit has to be hard-split.
        while len(line) > limit:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(line[:limit])
            line = line[limit:]
        candidate = f"{current}\n{line}" if current else line
        if len(candidate) > limit:
            chunks.append(current)
            current = line
        else:
            current = candidate
    if current or not chunks:
        chunks.append(current)
    return chunks


async def reply_long(message, text: str, parse_mode: str | None = None, **kwargs) -> None:
    """Reply with `text`, split into Telegram-sized chunks."""
    for chunk in chunk_text(text):
        if parse_mode:
            await message.reply_text(chunk, parse_mode=parse_mode, **kwargs)
        else:
            await message.reply_text(chunk, **kwargs)
