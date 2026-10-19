<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fromJson, type JsonValue } from '@bufbuild/protobuf';
  import { t } from '$i18n';
  import { PasswordResetResponseSchema, RegisterStartResponseSchema } from '$lib/gen/auth/v1/auth_pb';
  import { api, errorMessage } from '$lib/api';
  import { registerFinish, registerStart } from '$lib/opaque';
  import { isAcceptable, passwordStrength } from '$lib/password';
  import { notify } from '$lib/toast.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import AuthLayout from '$lib/components/AuthLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

  let ticket = $state($page.url.searchParams.get('ticket') ?? '');
  let phase = $state<'loading' | 'totp' | 'password' | 'done' | 'expired'>('loading');
  let attemptId = $state('');
  let grant = $state('');
  let code = $state('');
  let password = $state('');
  let confirm = $state('');
  let loading = $state(false);
  let open = $state(true);

  const strength = $derived(password ? passwordStrength(password) : null);
  const mismatch = $derived(confirm.length > 0 && confirm !== password);
  const canSubmit = $derived(isAcceptable(password) && password === confirm);

  onMount(() => {
    if (!ticket) {
      phase = 'expired';
      return;
    }
    void gate();
  });

  async function gate() {
    try {
      const res = fromJson(
        PasswordResetResponseSchema,
        await api<JsonValue>('/api/v1/auth/password/reset', { method: 'POST', body: { ticket } })
      );
      if (res.mfaRequired) {
        attemptId = res.attemptId ?? '';
        phase = 'totp';
      } else {
        grant = res.resetGrant ?? '';
        phase = 'password';
      }
    } catch {
      phase = 'expired';
    }
  }

  async function verifyCode(event: Event) {
    event.preventDefault();
    if (!code || loading) return;
    loading = true;
    try {
      const res = fromJson(
        PasswordResetResponseSchema,
        await api<JsonValue>('/api/v1/auth/password/reset/verify', {
          method: 'POST',
          body: { ticket, attempt_id: attemptId, code }
        })
      );
      grant = res.resetGrant ?? '';
      phase = 'password';
    } catch (error) {
      notify.error(errorMessage(error));
      code = '';
    } finally {
      loading = false;
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (!canSubmit || !grant) return;
    loading = true;
    try {
      const start = await registerStart(password);
      const started = fromJson(
        RegisterStartResponseSchema,
        await api<JsonValue>('/api/v1/auth/register/start', {
          method: 'POST',
          body: { reset_grant: grant, request: start.request }
        })
      );
      const upload = await registerFinish(password, start.state, started.response);
      await api('/api/v1/auth/register/finish', {
        method: 'POST',
        body: { user_id: started.userId, upload }
      });
      phase = 'done';
      open = false;
    } catch (error) {
      notify.error(errorMessage(error));
      loading = false;
    }
  }
</script>

{#if phase === 'expired'}
  <AuthLayout title={t('reset.title')} subtitle={t('reset.subtitle')}>
    <Alert kind="error">{t('errors.expired')}</Alert>
    <Button href="/forgot-password" full>{t('forgot.title')}</Button>
  </AuthLayout>
{:else if phase === 'loading'}
  <AuthLayout title={t('common.loading')}>
    <p class="flex justify-center py-8"><Spinner /></p>
  </AuthLayout>
{:else if phase === 'done'}
  <AuthLayout title={t('reset.done')} subtitle={t('reset.doneBody')}>
    <Button href="/" full>{t('reset.goToLogin')}</Button>
  </AuthLayout>
{:else if phase === 'totp'}
  <AuthLayout title={t('reset.mfaTitle')} subtitle={t('reset.mfaSubtitle')}>
    <form onsubmit={verifyCode} class="stack">
      <Input
        label={t('reset.mfaCode')}
        name="reset-code"
        inputmode="numeric"
        autocomplete="one-time-code"
        bind:value={code}
        required
      />
      <Button type="submit" full loading={loading} disabled={!code}>{t('reset.mfaVerify')}</Button>
    </form>
  </AuthLayout>
{:else}
  <AuthLayout title={t('reset.newTitle')} subtitle={t('reset.newSubtitle')}>
    <Button full onclick={() => (open = true)}>{t('reset.newTitle')}</Button>
  </AuthLayout>

  <Modal
    {open}
    title={t('reset.newTitle')}
    subtitle={t('reset.newSubtitle')}
    onclose={() => goto('/')}
  >
    <form onsubmit={submit} class="stack">
      <Input
        label={t('reset.newPassword')}
        type="password"
        name="new-password"
        autocomplete="new-password"
        hint={t('register.passwordHint')}
        bind:value={password}
        required
      />
      {#if strength}
        <div class="meter" data-score={strength.score}>
          <div class="meter-bars" aria-hidden="true">
            {#each [0, 1, 2, 3] as level (level)}
              <span class:on={strength.score >= level}></span>
            {/each}
          </div>
          <span class="meter-label">{t(strength.labelKey)}</span>
        </div>
      {/if}
      <Input
        label={t('reset.confirm')}
        type="password"
        name="confirm-password"
        autocomplete="new-password"
        error={mismatch ? t('reset.mismatch') : undefined}
        bind:value={confirm}
        required
      />
      <Button type="submit" full loading={loading} disabled={!canSubmit}>
        {t('reset.submit')}
      </Button>
    </form>
  </Modal>
{/if}
