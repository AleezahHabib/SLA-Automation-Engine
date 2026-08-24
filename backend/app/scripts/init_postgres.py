import asyncio
import asyncpg


async def setup_postgres():
    conn = await asyncpg.connect(
        user="postgres",
        password="postgres",
        host="127.0.0.1",
        port=5432,
        database="postgres",
    )
    exists = await conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = 'sla_engine';"
    )
    if not exists:
        await conn.execute("CREATE DATABASE sla_engine;")
        print("Database 'sla_engine' created successfully.")
    else:
        print("Database 'sla_engine' already exists.")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(setup_postgres())
