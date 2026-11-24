export interface DebugConsoleActions {
  teleport(query: string): Promise<string>;
  spawnVehicle(): string;
  toggleNoclip(): string;
}

export class DebugConsole {
  private readonly root: HTMLElement;
  private readonly output: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly actions: DebugConsoleActions;

  constructor(
    root: HTMLElement,
    output: HTMLElement,
    form: HTMLFormElement,
    input: HTMLInputElement,
    actions: DebugConsoleActions,
  ) {
    this.root = root;
    this.output = output;
    this.input = input;
    this.actions = actions;
    form.addEventListener('submit', (event: SubmitEvent) => {
      event.preventDefault();
      const command = this.input.value.trim();
      this.input.value = '';
      if (!command) return;
      this.append(`> ${command}`);
      void this.execute(command);
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('is-hidden');
  }
  get isInputFocused(): boolean {
    return document.activeElement === this.input;
  }

  setOpen(open: boolean): void {
    this.root.classList.toggle('is-hidden', !open);
    if (open) this.input.focus();
    else this.input.blur();
  }

  toggle(): void {
    this.setOpen(!this.isOpen);
  }

  append(message: string): void {
    const previous = this.output.textContent?.split('\n').slice(-7) ?? [];
    this.output.textContent = [...previous, message].join('\n');
  }

  private async execute(source: string): Promise<void> {
    const [command, ...arguments_] = source.split(/\s+/);
    const argument = arguments_.join(' ');
    try {
      if (command === 'help') {
        this.append(
          'Comandos: tp <hito>, spawn vehicle, noclip. time/weather/god/wanted aún no tienen sistema asociado.',
        );
      } else if (command === 'tp' && argument) {
        this.append(await this.actions.teleport(argument));
      } else if (command === 'spawn' && argument === 'vehicle') {
        this.append(this.actions.spawnVehicle());
      } else if (command === 'noclip') {
        this.append(this.actions.toggleNoclip());
      } else if (['time', 'weather', 'god', 'wanted'].includes(command ?? '')) {
        this.append(
          `«${command}» no está disponible: el sistema correspondiente aún no existe en esta versión.`,
        );
      } else {
        this.append('Comando no reconocido. Escribe help.');
      }
    } catch (error) {
      this.append(error instanceof Error ? error.message : String(error));
    }
  }
}
