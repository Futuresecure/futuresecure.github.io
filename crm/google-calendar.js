/* Backend-owned Google Calendar connection. No OAuth tokens are stored in this page. */
(() => {
  const ownerId = '4bd1c093-0912-4e63-a062-21d8fd759357';
  let loading = false, busy = false;
  function panel() {
    let box = document.getElementById('googleCalendarConnection');
    if (!box) {
      box = document.createElement('div');
      box.id = 'googleCalendarConnection';
      box.className = 'card';
      box.innerHTML = '<h3>Google Calendar</h3><p id="googleCalendarStatus" role="status" aria-live="polite">Checking connection…</p><div class="actions"><button type="button" class="btn-primary" id="googleCalendarConnect">Connect Google Calendar</button><button type="button" class="btn-secondary" id="googleCalendarRetry" hidden>Retry sync</button><button type="button" class="btn-secondary" id="googleCalendarRefresh">Refresh status</button></div><p style="font-size:13px;color:var(--muted)">Linked appointments sync automatically, usually within a minute. Appointment times use India Standard Time.</p><div id="googleCalendarJobs"></div>';
      document.getElementById('calendarPage').prepend(box);
      document.getElementById('googleCalendarConnect').onclick = () => action('start');
      document.getElementById('googleCalendarRetry').onclick = () => action('retry');
      document.getElementById('googleCalendarRefresh').onclick = () => refresh();
    }
    return box;
  }
  async function api(action) {
    const {data,error} = await supabaseClient.functions.invoke('google-calendar-oauth',{body:{action}});
    if(error) {
      let message = 'Unable to reach Calendar service. Refresh or sign in again.';
      try { message = (await error.context.json()).error || message; } catch (_) {}
      throw new Error(message);
    }
    if(!data?.ok) throw new Error(data?.error || 'Calendar operation failed');
    return data;
  }
  async function refresh() {
    if(!currentUser || currentUser.id !== ownerId) {
      document.getElementById('googleCalendarConnection')?.remove(); return;
    }
    if(loading || busy) return;
    loading = true; panel();
    try {
      const data = await api('status');
      if(currentUser?.id !== ownerId) return;
      const jobs = data.jobs || [], pending = jobs.filter(j=>j.status==='pending').length;
      const failed = jobs.filter(j=>j.status==='error').length;
      const connected = data.connection?.status === 'connected';
      document.getElementById('googleCalendarStatus').textContent = !data.configured ? 'Google OAuth setup is incomplete.' : connected ? 'Connected · '+pending+' pending · '+failed+' need attention' : data.connection ? 'Google authorization needs renewal. Reconnect below.' : 'Not connected. Choose the Google account containing your existing appointment events.';
      document.getElementById('googleCalendarConnect').textContent = data.connection ? 'Reconnect Google Calendar' : 'Connect Google Calendar';
      document.getElementById('googleCalendarRetry').hidden = !connected;
      const list = document.getElementById('googleCalendarJobs'); list.replaceChildren();
      for(const job of jobs) {
        const line = document.createElement('p');
        line.style.fontSize = '13px';
        line.textContent = 'Appointment #'+job.appointment_id+': '+job.status+(job.last_error ? ' — '+job.last_error : '');
        list.append(line);
      }
    } catch(e) { const label=document.getElementById('googleCalendarStatus'); if(label)label.textContent=e.message; }
    finally { loading = false; }
  }
  async function action(name) {
    if(busy) return;
    busy = true;
    const box=panel(); box.querySelectorAll('button').forEach(b=>b.disabled=true);
    document.getElementById('googleCalendarStatus').textContent=name==='start'?'Opening Google authorization…':'Retrying sync…';
    try {
      const data=await api(name);
      if(name==='start') {
        const url=new URL(data.url);
        if(url.origin!=='https://accounts.google.com')throw new Error('Invalid Google authorization link');
        window.location.assign(url.href); return;
      }
      busy=false; await refresh();
    } catch(e) { document.getElementById('googleCalendarStatus').textContent=e.message; }
    finally { busy=false; box.querySelectorAll('button').forEach(b=>b.disabled=false); }
  }
  window.refreshGoogleCalendarStatus=refresh;
  setInterval(()=>{
    if(!document.hidden && !document.getElementById('calendarPage')?.classList.contains('hidden')) refresh();
  },15000);
})();
