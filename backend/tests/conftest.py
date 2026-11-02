import os

os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-use-0123456789")
os.environ["GROQ_API_KEY"] = ""
