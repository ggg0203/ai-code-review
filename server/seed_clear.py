import asyncio
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from app.core.database import async_session
from app.models.review import Review
from sqlalchemy import delete
async def clear():
    async with async_session() as db:
        await db.execute(delete(Review))
        await db.commit()
        print("已清空")
asyncio.run(clear())