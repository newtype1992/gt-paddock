"""Local pairing UI. Never place the credential in navigation URLs or files."""
import tkinter as tk
from tkinter import ttk, messagebox
import webbrowser

APP_URL = 'http://127.0.0.1:4178/#Live%20telemetry'


def clear_owned_clipboard(root, token):
    try:
        if root.clipboard_get() == token:
            root.clipboard_clear()
    except tk.TclError:
        pass


class PairingWindow:
    def __init__(self, token, console):
        self.token = token
        self.root = tk.Tk()
        self.root.title('GT Paddock Companion')
        self.root.minsize(460, 340)
        self.root.geometry('520x370')
        self.reveal_timer = None
        self.copy_timer = None
        frame = ttk.Frame(self.root, padding=24)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='GT Paddock Companion', font=('Segoe UI', 18, 'bold')).pack(anchor='w')
        ttk.Label(frame, text=f'PlayStation: {console}', padding=(0, 12)).pack(anchor='w')
        ttk.Label(frame, text='Pairing code').pack(anchor='w')
        self.entry = ttk.Entry(frame, show='*', font=('Consolas', 12))
        self.entry.insert(0, token)
        self.entry.configure(state='readonly')
        self.entry.pack(fill='x', pady=8)
        actions = ttk.Frame(frame)
        actions.pack(fill='x')
        self.reveal = ttk.Button(actions, text='Show code', command=self.toggle)
        self.reveal.pack(side='left')
        ttk.Button(actions, text='Copy code', command=self.copy).pack(side='left', padx=8)
        ttk.Button(actions, text='Open GT Paddock', command=lambda: webbrowser.open(APP_URL)).pack(side='left')
        self.feedback = tk.StringVar(value='Keep this window open while driving.')
        ttk.Label(frame, textvariable=self.feedback, wraplength=450, padding=(0, 16)).pack(anchor='w')
        ttk.Label(frame, text='Copied codes clear after 45 seconds if unchanged. Clipboard history or sync may retain a copy. Only paste into GT Paddock.', wraplength=450).pack(anchor='w')
        ttk.Button(frame, text='Stop companion', command=self.close).pack(anchor='e', pady=16)
        self.root.protocol('WM_DELETE_WINDOW', self.close)

    def hide(self):
        self.entry.configure(show='*')
        self.reveal.configure(text='Show code')
        self.reveal_timer = None

    def toggle(self):
        if self.reveal_timer is not None:
            self.root.after_cancel(self.reveal_timer)
            self.reveal_timer = None
        if self.entry.cget('show'):
            self.entry.configure(show='')
            self.reveal.configure(text='Hide code')
            self.reveal_timer = self.root.after(30000, self.hide)
        else:
            self.hide()

    def copy(self):
        try:
            self.root.clipboard_clear()
            self.root.clipboard_append(self.token)
            if self.copy_timer is not None:
                self.root.after_cancel(self.copy_timer)
            self.copy_timer = self.root.after(45000, self.clear_clipboard)
            self.feedback.set('Code copied. Paste into Live telemetry, then select Connect.')
        except tk.TclError:
            self.feedback.set('Clipboard unavailable. Select Show code and enter it manually.')

    def clear_clipboard(self):
        clear_owned_clipboard(self.root, self.token)
        self.copy_timer = None
        self.feedback.set('Clipboard cleanup checked. Copy again if needed.')

    def close(self):
        if messagebox.askyesno('Stop companion?', 'This stops telemetry and finalizes the active recording. Stop now?', parent=self.root):
            self.destroy()

    def destroy(self):
        if self.copy_timer is not None:
            clear_owned_clipboard(self.root, self.token)
        self.root.destroy()

    def run(self):
        self.root.mainloop()
