(function () {
  // ============================================================================
  // DIAGNOSTIC VERSION - crm-auto-lead.js.DIAGNOSTIC-FINAL
  // ============================================================================
  // Build timestamp for cache verification
  var DIAGNOSTIC_BUILD_TIME = "2026-09-07T14:30:45Z";
  var DIAGNOSTIC_VERSION = "crm-auto-lead.js.DIAGNOSTIC-FINAL v1 (" + DIAGNOSTIC_BUILD_TIME + ")";
  
  // ============================================================================
  // DIAGNOSTIC LOGGING SYSTEM
  // ============================================================================
  window.diagnosticLogs = [];
  window.diagnosticStartTime = new Date().toISOString();
  window.diagnosticMode = true;
  
  function logDiagnostic(message, level, data) {
    level = level || "DEBUG";
    var now = new Date();
    var timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                  now.getMinutes().toString().padStart(2, '0') + ':' + 
                  now.getSeconds().toString().padStart(2, '0');
    
    var logEntry = '[' + timeStr + '] ' + message;
    if (data && typeof data === 'object') {
      logEntry += ' (' + JSON.stringify(data).substring(0, 40) + ')';
    } else if (data) {
      logEntry += ' (' + String(data).substring(0, 40) + ')';
    }
    
    window.diagnosticLogs.push(logEntry);
    console.log("[CRM-" + level + "] " + logEntry);
  }
  
  // Log initialization
  logDiagnostic("crm-auto-lead.js DIAGNOSTIC-FINAL loaded", "INFO");
  logDiagnostic("Build: " + DIAGNOSTIC_BUILD_TIME, "INFO");
  logDiagnostic("Startup time: " + window.diagnosticStartTime, "INFO");
  
  // ============================================================================
  // DIAGNOSTIC MODE INDICATOR
  // ============================================================================
  function addDiagnosticModeIndicator() {
    if (document.body) {
      document.body.style.border = "3px solid orange";
      var marker = document.createElement("div");
      marker.id = "crm-diagnostic-mode-marker";
      marker.textContent = "🔧 DIAGNOSTIC MODE 🔧";
      marker.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        background: orange;
        color: black;
        padding: 8px 12px;
        font-size: 11px;
        font-weight: bold;
        z-index: 9999;
        border: 1px solid #333;
        border-top: none;
        border-right: none;
        font-family: monospace;
      `;
      document.body.appendChild(marker);
      logDiagnostic("Diagnostic mode indicator added", "DEBUG");
    }
  }
  
  // Wait for DOM ready
  if (document.body) {
    addDiagnosticModeIndicator();
  } else {
    window.addEventListener('DOMContentLoaded', addDiagnosticModeIndicator);
  }
  
  // ============================================================================
  // DATA MASKING FOR PRIVACY
  // ============================================================================
  function maskData(value, type) {
    if (!value) return "N/A";
    var s = String(value);
    if (type === "name" && s.length > 2) {
      return s.substring(0, 4) + (s.length > 4 ? " " + s.substring(-1) + "..." : "");
    } else if (type === "mobile" && s.length >= 4) {
      return s.substring(0, 4) + "***";
    } else if (type === "email") {
      return s.split('@')[0].substring(0, 3) + "***@***";
    }
    return s.substring(0, 5) + "***";
  }
  
  // ============================================================================
  // CONSTANTS
  // ============================================================================
  var SUPABASE_URL = "https://cjwxirpwzluynymwjzxl.supabase.co";
  var SUPABASE_KEY = "sb_publishable_jkr9U6yu6ODDa4JvHmrE4w_gIWJBsOz";
  
  logDiagnostic("SUPABASE_URL configured", "DEBUG");
  logDiagnostic("SUPABASE_KEY available: YES (public key)", "DEBUG");

  // ============================================================================
  // GET SUPABASE SDK
  // ============================================================================
  function getSupabase() {
    logDiagnostic("getSupabase() called", "DEBUG");
    
    if (window.supabase && window.supabase.createClient) {
      logDiagnostic("window.supabase already available (cached)", "DEBUG");
      return Promise.resolve(window.supabase);
    }

    logDiagnostic("window.supabase not found, will load from CDN", "DEBUG");
    
    return new Promise(function (resolve, reject) {
      logDiagnostic("Creating script element for SDK", "DEBUG");
      
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      
      logDiagnostic("Script src set: " + script.src, "DEBUG");
      
      var loadTimeout = setTimeout(function() {
        logDiagnostic("*** SCRIPT LOAD TIMEOUT (5 seconds) ***", "ERROR");
        logDiagnostic("onload/onerror was never called", "ERROR");
        reject(new Error("Script loading timeout - no onload/onerror"));
      }, 5000);

      script.onload = function () {
        clearTimeout(loadTimeout);
        logDiagnostic("*** SCRIPT ONLOAD FIRED ***", "INFO");
        logDiagnostic("window.supabase available: " + (window.supabase ? "YES" : "NO"), "DEBUG");
        
        if (window.supabase && window.supabase.createClient) {
          logDiagnostic("Supabase SDK loaded and ready", "INFO");
          resolve(window.supabase);
        } else {
          logDiagnostic("Script loaded but window.supabase not found", "ERROR");
          reject(new Error("Supabase SDK loaded but not available on window"));
        }
      };

      script.onerror = function(err) {
        clearTimeout(loadTimeout);
        logDiagnostic("*** SCRIPT ONERROR FIRED ***", "ERROR");
        logDiagnostic("Error event type: " + (err && err.type ? err.type : "unknown"), "ERROR");
        logDiagnostic("Script src was: " + script.src, "ERROR");
        reject(new Error("Failed to load Supabase SDK from CDN"));
      };

      logDiagnostic("Appending script tag to document.head", "DEBUG");
      document.head.appendChild(script);
      logDiagnostic("Script tag appended", "DEBUG");
    });
  }

  // ============================================================================
  // CLEAN MOBILE FUNCTION
  // ============================================================================
  function cleanMobile(value) {
    var mobile = String(value || "").replace(/\D/g, "");
    if (mobile.length === 12 && mobile.indexOf("91") === 0) mobile = mobile.slice(2);
    if (mobile.length === 11 && mobile.charAt(0) === "0") mobile = mobile.slice(1);
    return mobile;
  }

  // ============================================================================
  // MAIN SAVE WEBSITE LEAD FUNCTION
  // ============================================================================
  async function saveWebsiteLead() {
    logDiagnostic("=== saveWebsiteLead() ASYNC FUNCTION STARTED ===", "INFO");
    
    try {
      // Step 1: Get form fields
      logDiagnostic("STEP 1: Checking form fields", "DEBUG");
      
      var nameEl = document.getElementById("fspName");
      var phoneEl = document.getElementById("fspPhone");

      logDiagnostic("Form field: nameEl = " + (nameEl ? "FOUND" : "NOT FOUND"), "DEBUG");
      logDiagnostic("Form field: phoneEl = " + (phoneEl ? "FOUND" : "NOT FOUND"), "DEBUG");

      if (!nameEl || !phoneEl) {
        logDiagnostic("ERROR: Required form fields not found", "ERROR");
        return { success: false, error: "Form fields not found" };
      }

      // Step 2: Collect form data
      logDiagnostic("STEP 2: Collecting form data", "DEBUG");
      
      var fullName = nameEl.value.trim();
      var mobile = cleanMobile(phoneEl.value);

      logDiagnostic("Collected name: " + maskData(fullName, "name"), "DEBUG");
      logDiagnostic("Collected mobile: " + maskData(mobile, "mobile"), "DEBUG");

      // Step 3: Validate form data
      logDiagnostic("STEP 3: Validating form data", "DEBUG");
      
      if (fullName.length < 2 || !/^[6-9]\d{9}$/.test(mobile)) {
        logDiagnostic("ERROR: Form validation failed", "ERROR");
        return { success: false, error: "Invalid name or mobile number" };
      }

      logDiagnostic("Form validation: PASSED", "DEBUG");

      // Step 4: Collect additional fields
      logDiagnostic("STEP 4: Collecting additional fields", "DEBUG");
      
      var pincodeEl = document.getElementById("fspPincode");
      var pincode = pincodeEl ? pincodeEl.value.trim() : "";
      logDiagnostic("Pincode: " + (pincode ? "PROVIDED" : "EMPTY"), "DEBUG");

      var members = [];
      document.querySelectorAll("#fspAges .fsp-age").forEach(function(i) {
        members.push(i.getAttribute("data-label") + " (" + (i.value || "?") + ")");
      });
      var membersStr = members.join(", ");
      logDiagnostic("Family members: " + (members.length > 0 ? members.length + " selected" : "NONE"), "DEBUG");

      var med = [];
      document.querySelectorAll("#fspMedical input:checked").forEach(function(i) {
        med.push(i.value);
      });
      var medStr = med.length ? med.join(", ") : "இல்லை";
      logDiagnostic("Medical info: " + (med.length > 0 ? "PROVIDED" : "NONE"), "DEBUG");

      var us = sessionStorage.getItem("fsp_utm_source") || "";
      var uc = sessionStorage.getItem("fsp_utm_campaign") || "";
      var leadSource = us === "MetaAds" ? "Meta Ads" : (us ? us : "Website Quote Form");
      logDiagnostic("Lead source: " + leadSource, "DEBUG");

      var notes = [];
      if (membersStr) notes.push("Family: " + membersStr);
      if (pincode) notes.push("Pincode: " + pincode);
      if (medStr && medStr !== "இல்லை") notes.push("Medical: " + medStr);
      var notesStr = notes.join(" | ");

      // Step 5: Get Supabase SDK
      logDiagnostic("STEP 5: Loading Supabase SDK", "DEBUG");
      logDiagnostic("=== CHECKPOINT: About to await getSupabase() ===", "INFO");
      
      var supabase;
      try {
        supabase = await getSupabase();
        logDiagnostic("getSupabase() RESOLVED successfully", "INFO");
        logDiagnostic("supabase object type: " + typeof supabase, "DEBUG");
      } catch (err) {
        logDiagnostic("=== getSupabase() REJECTED ===", "ERROR");
        logDiagnostic("Error message: " + err.message, "ERROR");
        return { success: false, error: "SDK loading failed: " + err.message };
      }

      // Step 6: Create client
      logDiagnostic("STEP 6: Creating Supabase client", "DEBUG");
      logDiagnostic("=== CHECKPOINT: Creating client ===", "INFO");
      
      var client;
      try {
        client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        logDiagnostic("Client created successfully", "DEBUG");
      } catch (err) {
        logDiagnostic("ERROR: Client creation failed: " + err.message, "ERROR");
        return { success: false, error: "Client creation failed: " + err.message };
      }

      // Step 7: Duplicate check
      logDiagnostic("STEP 7: Checking for duplicate mobile number", "DEBUG");
      logDiagnostic("=== CHECKPOINT: Duplicate check query ===", "INFO");
      logDiagnostic("Querying for mobile: " + maskData(mobile, "mobile"), "DEBUG");
      
      var existing;
      try {
        var dupQuery = client
          .from("leads")
          .select("id")
          .eq("mobile_number", mobile)
          .limit(1);

        existing = await dupQuery;
        logDiagnostic("Duplicate check query completed", "DEBUG");
        logDiagnostic("Result: error=" + (existing.error ? "YES" : "NO") + ", data=" + (existing.data ? "YES" : "NO"), "DEBUG");
      } catch (err) {
        logDiagnostic("ERROR: Duplicate check failed: " + err.message, "ERROR");
        return { success: false, error: "Duplicate check failed: " + err.message };
      }

      if (existing.error) {
        logDiagnostic("ERROR: Duplicate check query returned error: " + existing.error.message, "ERROR");
        return { success: false, error: "Duplicate check failed: " + existing.error.message };
      }

      if (existing.data && existing.data.length > 0) {
        var existingLeadId = existing.data[0].id;
        logDiagnostic("Duplicate lead found with ID: " + existingLeadId, "INFO");
        return {
          success: true,
          duplicate: true,
          lead_id: existingLeadId,
          message: "Lead already exists"
        };
      }

      logDiagnostic("No duplicate found, proceeding with new lead creation", "DEBUG");

      // Step 8: Insert lead
      logDiagnostic("STEP 8: Creating new lead", "DEBUG");
      logDiagnostic("=== CHECKPOINT: Lead INSERT ===", "INFO");
      logDiagnostic("Inserting lead: " + maskData(fullName, "name"), "DEBUG");
      
      var insert;
      try {
        var insertPayload = {
          full_name: fullName,
          mobile_number: mobile,
          city: pincode ? "Pincode: " + pincode : null,
          lead_source: leadSource,
          status: "New",
          next_follow_up: null,
          notes: notesStr
        };

        var insertQuery = client
          .from("leads")
          .insert([insertPayload])
          .select()
          .single();

        insert = await insertQuery;
        logDiagnostic("Lead INSERT query completed", "DEBUG");
        logDiagnostic("Result: error=" + (insert.error ? "YES" : "NO") + ", data=" + (insert.data ? "YES" : "NO"), "DEBUG");
      } catch (err) {
        logDiagnostic("ERROR: Lead INSERT failed: " + err.message, "ERROR");
        return { success: false, error: "Failed to save lead: " + err.message };
      }

      if (insert.error) {
        logDiagnostic("ERROR: INSERT query returned error: " + insert.error.message, "ERROR");
        return { success: false, error: "Failed to save lead: " + insert.error.message };
      }

      if (!insert.data || !insert.data.id) {
        logDiagnostic("ERROR: INSERT succeeded but no ID returned", "ERROR");
        return {
          success: false,
          error: "Lead was saved but no lead ID was returned"
        };
      }

      var leadId = insert.data.id;
      logDiagnostic("*** LEAD CREATED SUCCESSFULLY ***", "INFO");
      logDiagnostic("Lead ID: " + leadId, "INFO");

      // Step 9: Create activity
      logDiagnostic("STEP 9: Creating lead activity record", "DEBUG");
      logDiagnostic("=== CHECKPOINT: Activity INSERT ===", "INFO");
      
      try {
        var activityResult = await client
          .from("lead_activities")
          .insert([{
            lead_id: leadId,
            activity_type: "Lead Created",
            description: "Website Quote Form",
            notes: "Source: " + leadSource
          }]);
        
        logDiagnostic("Activity creation completed", "DEBUG");
        logDiagnostic("Result: " + (activityResult.error ? "ERROR" : "SUCCESS"), "DEBUG");
      } catch (err) {
        logDiagnostic("WARN: Activity creation failed (non-blocking): " + err.message, "WARN");
      }

      // Step 10: Create task
      logDiagnostic("STEP 10: Creating auto task", "DEBUG");
      logDiagnostic("=== CHECKPOINT: Task INSERT ===", "INFO");
      
      try {
        var taskResult = await client
          .from("tasks")
          .insert([{
            lead_id: leadId,
            description: "Follow-up call",
            status: "Pending"
          }]);
        
        logDiagnostic("Task creation completed", "DEBUG");
        logDiagnostic("Result: " + (taskResult.error ? "ERROR" : "SUCCESS"), "DEBUG");
      } catch (err) {
        logDiagnostic("WARN: Task creation failed (non-blocking): " + err.message, "WARN");
      }

      // Success
      logDiagnostic("=== ALL STEPS COMPLETED SUCCESSFULLY ===", "INFO");
      logDiagnostic("Final result: SUCCESS", "INFO");
      
      return {
        success: true,
        lead_id: leadId,
        full_name: fullName,
        mobile_number: mobile
      };

    } catch (err) {
      logDiagnostic("=== UNEXPECTED ERROR ===", "ERROR");
      logDiagnostic("Error message: " + err.message, "ERROR");
      logDiagnostic("Error type: " + typeof err, "ERROR");
      
      // Show diagnostic panel on error
      setTimeout(function() {
        showDiagnosticPanel();
      }, 500);
      
      return { success: false, error: "Unexpected error: " + err.message };
    }
  }

  // ============================================================================
  // DIAGNOSTIC PANEL DISPLAY
  // ============================================================================
  function showDiagnosticPanel() {
    logDiagnostic("showDiagnosticPanel() called", "DEBUG");
    
    // Create panel container
    var panel = document.createElement("div");
    panel.id = "crm-diagnostic-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Diagnostic Results");
    
    var now = new Date();
    var buildTime = new Date(DIAGNOSTIC_BUILD_TIME);
    var ageSeconds = Math.round((now - buildTime) / 1000);
    var isFresh = ageSeconds < 300;
    var statusText = isFresh ? "✓ Fresh (not cached)" : "⚠ OLD FILE (possibly cached)";
    var statusColor = isFresh ? "#28a745" : "#ff6b6b";
    
    // Panel styling
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      max-width: 500px;
      max-height: 85vh;
      background: white;
      border: 2px solid #333;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      z-index: 10000;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
    `;
    
    // Header
    var header = document.createElement("div");
    header.style.cssText = "padding: 12px 15px; background: #f0f0f0; border-bottom: 1px solid #ddd; flex-shrink: 0;";
    header.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">
        📊 DIAGNOSTIC RESULTS (Temporary Testing)
      </div>
      <div style="font-size: 11px; color: #333; line-height: 1.6;">
        <div><strong>File:</strong> ${DIAGNOSTIC_VERSION}</div>
        <div><strong>Built:</strong> ${DIAGNOSTIC_BUILD_TIME}</div>
        <div><strong>Loaded:</strong> ${now.toISOString()}</div>
        <div><strong>Age:</strong> ${ageSeconds} seconds</div>
        <div><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></div>
      </div>
    `;
    panel.appendChild(header);
    
    // Logs content (scrollable)
    var logsDiv = document.createElement("div");
    logsDiv.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px 15px;
      background: #fafafa;
      border-bottom: 1px solid #ddd;
      color: #333;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
      font-size: 11px;
    `;
    logsDiv.textContent = window.diagnosticLogs.join("\n");
    panel.appendChild(logsDiv);
    
    // Diagnosis summary
    var summary = document.createElement("div");
    summary.style.cssText = "padding: 12px 15px; background: #f9f9f9; border-bottom: 1px solid #ddd; font-size: 11px; flex-shrink: 0;";
    var lastLog = window.diagnosticLogs.length > 0 ? window.diagnosticLogs[window.diagnosticLogs.length - 1] : "No logs";
    summary.innerHTML = `
      <div><strong>Last checkpoint:</strong></div>
      <div style="margin-top: 4px; color: #555;">${lastLog}</div>
      <div style="margin-top: 8px; color: #d32f2f;"><strong>Status:</strong> CRM insertion failed or not attempted</div>
    `;
    panel.appendChild(summary);
    
    // Buttons
    var buttonBar = document.createElement("div");
    buttonBar.style.cssText = `
      padding: 12px;
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
      flex-shrink: 0;
      background: #f5f5f5;
    `;
    
    // Copy button
    var copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 COPY ALL";
    copyBtn.style.cssText = `
      padding: 10px 14px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      font-family: monospace;
      min-height: 44px;
      min-width: 80px;
      font-weight: bold;
    `;
    copyBtn.onclick = function() {
      var text = "=== FACEBOOK CRM DIAGNOSTIC RESULTS ===\n\n" +
                 "File: " + DIAGNOSTIC_VERSION + "\n" +
                 "Built: " + DIAGNOSTIC_BUILD_TIME + "\n" +
                 "Age: " + ageSeconds + " seconds\n" +
                 "Status: " + statusText + "\n\n" +
                 "=== EXECUTION TRACE ===\n\n" +
                 window.diagnosticLogs.join("\n") + "\n\n" +
                 "=== END ===\n";
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          copyBtn.textContent = "✓ COPIED!";
          setTimeout(function() {
            copyBtn.textContent = "📋 COPY ALL";
          }, 2000);
        }).catch(function(err) {
          // Fallback
          var textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand("copy");
            copyBtn.textContent = "✓ COPIED!";
            setTimeout(function() {
              copyBtn.textContent = "📋 COPY ALL";
            }, 2000);
          } catch (e) {
            copyBtn.textContent = "✗ FAILED";
          }
          document.body.removeChild(textarea);
        });
      }
    };
    buttonBar.appendChild(copyBtn);
    
    // Clear button
    var clearBtn = document.createElement("button");
    clearBtn.textContent = "🔄 CLEAR";
    clearBtn.style.cssText = `
      padding: 10px 14px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      font-family: monospace;
      min-height: 44px;
      min-width: 80px;
      font-weight: bold;
    `;
    clearBtn.onclick = function() {
      window.diagnosticLogs = [];
      logDiagnostic("Logs cleared by user", "INFO");
      logsDiv.textContent = window.diagnosticLogs.join("\n");
    };
    buttonBar.appendChild(clearBtn);
    
    // Close button
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ CLOSE";
    closeBtn.style.cssText = `
      padding: 10px 14px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      font-family: monospace;
      min-height: 44px;
      min-width: 80px;
      font-weight: bold;
    `;
    closeBtn.onclick = function() {
      if (document.body.contains(panel)) {
        document.body.removeChild(panel);
      }
    };
    buttonBar.appendChild(closeBtn);
    
    panel.appendChild(buttonBar);
    
    // Add to page
    document.body.appendChild(panel);
    logDiagnostic("Diagnostic panel displayed on page", "DEBUG");
  }

  // ============================================================================
  // EXPOSE FUNCTION TO GLOBAL SCOPE
  // ============================================================================
  window.saveWebsiteLead = saveWebsiteLead;
  logDiagnostic("window.saveWebsiteLead exposed globally", "DEBUG");
  logDiagnostic("=== INITIALIZATION COMPLETE ===", "INFO");
})();
