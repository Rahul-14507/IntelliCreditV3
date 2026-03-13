import asyncio
import aiosqlite

async def check():
    async with aiosqlite.connect("intellicredit.db") as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id, company_name FROM entities") as cursor:
            entities = await cursor.fetchall()
            for e in entities:
                print(f"ENTITY: {dict(e)}")
                async with db.execute("SELECT * FROM analyses WHERE entity_id = ?", (e['id'],)) as acursor:
                    analysis = await acursor.fetchone()
                    if analysis:
                        print(f"  ANALYSIS: {dict(analysis)['research_status']}, {dict(analysis)['analysis_status']}")
                    else:
                        print("  ANALYSIS: None")

if __name__ == "__main__":
    asyncio.run(check())
