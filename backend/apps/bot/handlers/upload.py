from telegram import Update
from telegram.ext import ContextTypes


async def upload_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "To upload documents for RAG-powered learning:\n\n"
        "1. Open the Lingaru web app\n"
        "2. Go to Documents page\n"
        "3. Upload your PDF or text files\n\n"
        "Once uploaded, I'll use your documents to give better, "
        "context-aware answers in /chat mode!"
    )
