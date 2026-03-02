import asyncio
from backend.database import create_tables
from backend.seed import run_seed

async def main():
    print("Initializing DB...")
    await create_tables()
    print("Starting full DB seed...")
    await run_seed()
    print("Done seeding.")

asyncio.run(main())
