<script lang="ts">
  type Props = {
    value: string;
    length?: number;
    label?: string;
    disabled?: boolean;
    error?: string;
    oncomplete?: (code: string) => void;
    onchange?: (code: string) => void;
  };

  let {
    value = $bindable(''),
    length = 6,
    label,
    disabled = false,
    error,
    oncomplete,
    onchange
  }: Props = $props();

  const uid = $props.id();
  let inputs = $state<HTMLInputElement[]>([]);
  let digits = $derived(Array.from({ length }, (_, i) => value[i] ?? ''));

  function write(next: string) {
    value = next.slice(0, length);
    onchange?.(value);
    if (value.length === length) oncomplete?.(value);
  }

  function setAt(index: number, char: string) {
    const arr = digits.slice();
    arr[index] = char;
    write(arr.join(''));
  }

  function focusAt(index: number) {
    inputs[index]?.focus();
  }

  function handleInput(index: number, raw: string) {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      setAt(index, '');
      return;
    }
    if (clean.length > 1) {
      const arr = value.padEnd(index, ' ').split('');
      for (let i = 0; i < clean.length && index + i < length; i++) arr[index + i] = clean[i];
      write(arr.join('').replace(/\s/g, ''));
      focusAt(Math.min(index + clean.length, length - 1));
      return;
    }
    setAt(index, clean);
    if (index < length - 1) focusAt(index + 1);
  }

  function handleKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      setAt(index - 1, '');
      focusAt(index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) focusAt(index - 1);
    if (event.key === 'ArrowRight' && index < length - 1) focusAt(index + 1);
  }

  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    write((event.clipboardData?.getData('text') ?? '').replace(/\D/g, ''));
    focusAt(Math.min(value.length, length - 1));
  }
</script>

<fieldset class="flex flex-col gap-2 border-0 p-0" disabled>
  {#if label}
    <legend class="p-0 text-[0.8125rem] font-semibold text-muted">{label}</legend>
  {/if}
  <div class="grid gap-2" style="grid-template-columns: repeat({length}, 1fr)">
    {#each digits as digit, i (i)}
      <input
        bind:this={inputs[i]}
        value={digit}
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength={1}
        {disabled}
        aria-label="{label ?? 'Code'} {i + 1} / {length}"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${uid}-error` : undefined}
        class="h-14 w-full rounded-control border bg-surface text-center text-[1.375rem] font-semibold tabular-nums outline-none transition duration-150 ease-out focus:border-ink focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--ring)_12%,transparent)] {error
          ? 'border-danger'
          : 'border-line'}"
        oninput={(event) => handleInput(i, event.currentTarget.value)}
        onkeydown={(event) => handleKeydown(i, event)}
        onpaste={handlePaste}
        onfocus={(event) => event.currentTarget.select()}
      />
    {/each}
  </div>
  {#if error}<p id={`${uid}-error`} class="text-[0.8125rem] text-ink">{error}</p>{/if}
</fieldset>
