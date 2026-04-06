# Nufi conjugation

Python tool that builds a **Word** (`.docx`) document of **Nufi** verb conjugation tables. It pulls conjugations from the [Resulam Nufi conjugator](https://resulam.com/nufi-conjugator/) API and formats them with `python-docx`.

## Prerequisites

- **Python 3.10+** (3.11 tested)
- A **`data_verb.json`** file: a JSON array of objects with at least `verb` and `translated_verb` (see script variable `path_verbs`).

## Setup

```powershell
cd path\to\this\repo
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Configuration

In `nufi_conjugation_to_word_document_short.py`, set:

| Variable | Purpose |
|----------|---------|
| `path_verbs` | Absolute or relative path to your `data_verb.json` |
| `file_name` | Output `.docx` filename (default: `conjugaison_nufi__short2.docx`) |
| `requirements_short` | Which verbs to include (category, group, syllable count, prefix constraints) |

The script uses the **public API** (`https://resulam.com/nufi-conjugator/?api=1`). You need a network connection while it runs.

## Run

```powershell
.\.venv\Scripts\Activate.ps1
python -u nufi_conjugation_to_word_document_short.py
```

`-u` disables output buffering so progress prints immediately.

## Output

Generates the Word file named by `file_name` in the current working directory. The document uses a custom paragraph style `Nufi` with **Charis SIL** if that font is installed.

## Dependencies

See `requirements.txt`: `python-docx`, `requests`, `beautifulsoup4` (the latter is used by optional localhost/HTML parsing helpers in the same file).
