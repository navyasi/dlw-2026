# dlw-2026

AI-driven adaptive learning engine for Blackboard "Study Mode" (Microsoft hackathon).

## Setup

1. **Clone the repo**
   ```bash
   git clone git@github.com:navyasi/dlw-2026.git
   cd dlw-2026
   ```

2. **Create your `.env` file**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and replace `sk-...` with the OpenAI API key.

3. **Set up the Python environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

## Run the demos

```bash
source .venv/bin/activate
set -a && source .env && set +a

python demo_learning_model.py   # Person 1 — learning engine (Yajie)
python demo_scheduler.py        # Person 3 — scheduler (Chavi)
```
