# AI Email Assistant

A personal AI-powered email assistant that generates context-aware emails from natural-language requests, reviews them independently, and sends only after explicit human approval.

## Project Structure

```
ai-email-assistant/
├── frontend/          Next.js 15 + TypeScript  
├── backend/           Spring Boot 3 + Java 17   
├── ai-service/        Python 3.11 + FastAPI      

```

## Prerequisites

| Tool       | Version  | Check              |
|------------|----------|--------------------|
| Node.js    | ≥ 18     | `node -v`          |
| npm        | ≥ 9      | `npm -v`           |
| Java (JDK) | 17       | `java -version`    |
| Maven      | ≥ 3.9    | `mvn -v`           |
| Python     | ≥ 3.11   | `python --version` |
| PostgreSQL | ≥ 15     | `psql --version`   |


## Quick Start

### 1. Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local 
npm install               
npm run dev                    # → http://localhost:3000
```

Health check: `curl http://localhost:3000/api/health`

### 2. Backend (Spring Boot)

```bash
cd backend
cp .env.example .env  

.\mvnw.cmd spring-boot:run     # → http://localhost:8080


### 3. AI Service (Python)

```bash
cd ai-service
python -m venv .venv

.venv\Scripts\activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # → http://localhost:8000
```

```


