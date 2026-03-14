import sys
import os
import json
from notebooklm import NotebookLMClient

def sync():
    # Load configuration
    config_dir = os.path.join(os.path.expanduser("~"), ".widget-tdc")
    if not os.path.exists(config_dir):
        os.makedirs(config_dir, mode=0o700)
    
    config_path = os.path.join(config_dir, "notebooklm_config.json")
    if not os.path.exists(config_path):
        print(json.dumps({"success": False, "error": "Configuration missing. Please set your __Secure-1PSID cookie."}))
        return

    # Secure file permissions on config
    try:
        os.chmod(config_path, 0o600)
    except OSError:
        pass  # Windows may not support chmod
    with open(config_path, "r") as f:
        config = json.load(f)

    cookie = config.get("__Secure-1PSID")
    if not cookie:
        print(json.dumps({"success": False, "error": "Cookie missing in configuration."}))
        return

    try:
        client = NotebookLMClient(sid=cookie)
        
        # 1. FIND OR CREATE NOTEBOOK
        notebooks = client.list_notebooks()
        target_notebook = None
        for nb in notebooks:
            if nb.title == "WidgeTDC Strategy Station":
                target_notebook = nb
                break
        
        if not target_notebook:
            target_notebook = client.create_notebook("WidgeTDC Strategy Station")

        # 2. HANDLE MODES
        args = sys.argv[1:]

        def get_arg(flag):
            if flag not in args:
                return None
            idx = args.index(flag) + 1
            return args[idx] if idx < len(args) else ""

        # ASK MODE: Grounded Q&A
        query = get_arg("--ask")
        if query is not None:
            if not query:
                print(json.dumps({"success": False, "error": "Query empty."}))
                return
            response = client.ask(target_notebook.id, query)
            print(json.dumps({"success": True, "answer": response.content}))
            return

        # CONTEXT MODE: Direct Text Injection (Breakthrough)
        content = get_arg("--context")
        if content is not None:
            if not content:
                print(json.dumps({"success": False, "error": "Content empty."}))
                return
            # Save context as a temporary source
            temp_path = os.path.join(config_dir, "canvas_context.md")
            with open(temp_path, "w", encoding="utf-8") as f:
                f.write(content)
            client.add_source(target_notebook.id, temp_path)
            print(json.dumps({"success": True, "message": "Neural context injected."}))
            return

        # AUDIO MODE: Trigger Podcast Generation (Breakthrough)
        if "--generate-audio" in args:
            # Trigger artifact generation
            try:
                # In most notebooklm-py versions, this triggers the RPC for audio overview
                client.create_audio_overview(target_notebook.id)
                print(json.dumps({"success": True, "message": "Audio Overview generation triggered (2-5 min)."}))
                return
            except Exception as e:
                print(json.dumps({"success": False, "error": f"Audio generation failed: {str(e)}"}))
                return

        # DEFAULT SYNC MODE: Upload strategic files
        docs_dir = os.path.join(os.path.expanduser("~"), "Documents", "NotebookLM")
        if os.path.exists(docs_dir):
            files = [f for f in os.listdir(docs_dir) if f.endswith(".md") or f.endswith(".pdf")]
            for file_name in files:
                file_path = os.path.join(docs_dir, file_name)
                client.add_source(target_notebook.id, file_path)

        print(json.dumps({"success": True, "notebook_id": target_notebook.id}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    sync()
