<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
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

  let ticket = $state($page.url.searchParams.get('ticket') ?? '');
  let password = $state('');
  let confirm = $state('');
  let loading = $state(false);
  let open = $state(true);
  let done = $state(false);

  const strength = $derived(password ? passwordStrength(password) : null);
  const mismatch = $derived(confirm.length > 0 && confirm !== password);
  const canSubmit = $derived(isAcceptable(password) && password === confirm);

  async function submit(event: Event) {
    event.preventDefault();
    if (!canSubmit || !ticket) return;
    loading = true;
    try {
      const start = await registerStart(password);
      const reset = fromJson(
        PasswordResetResponseSchema,
        await api<JsonValue>('/api/v1/auth/password/reset', { method: 'POST', body: { ticket } })
      );
      const started = fromJson(
        RegisterStartResponseSchema,
        await api<JsonValue>('/api/v1/auth/register/start', {
          method: 'POST',
          body: { reset_grant: reset.resetGrant, request: start.request }
        })
      );
      const upload = await registerFinish(password, start.state, started.response);
      await api('/api/v1/auth/register/finish', {
        method: 'POST',
        body: { user_id: started.userId, upload }
      });
      done = true;
      open = false;
    } catch (error) {
      notify.error(errorMessage(error));
      loading = false;
    }
  }
</script>

{#if !ticket}
  <AuthLayout title={t('reset.title')} subtitle={t('reset.subtitle')}>
    <Alert kind="error">{t('errors.expired')}</Alert>
    <Button href="/forgot-password" full>{t('forgot.title')}</Button>
  </AuthLayout>
{:else if done}
  <AuthLayout title={t('reset.done')} subtitle={t('reset.doneBody')}>
    <Button href="/" full>{t('reset.goToLogin')}</Button>
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
