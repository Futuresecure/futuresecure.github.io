(function () {
  // ============================================================================
  // RPC VERSION - crm-auto-lead.js (calls handle_website_lead_creation RPC)
  // ============================================================================
  // This version calls a server-side RPC function instead of direct inserts
  // Better security, atomic operations, follows best practices
  
  var DIAGNOSTIC_BUILD_TIME = "2026-09-07T15:00:00Z";
  var DIAGNOSTIC_VERSION = "crm-auto-lead.js.RPC-VERSION v1 (" + DIAGNOSTIC_BUILD_TIME + ")";
  
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
  
  logDiagnostic("crm-auto-lead.js RPC-VERSION loaded", "INFO");
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
  // MAIN SAVE WEBSITE LEAD FUNCTION (RPC VERSION)
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
      } catch (err) {
        logDiagnostic("=== getSupabase() REJECTED ===", "ERROR");
        logDiagnostic("Error message: " + err.message, "ERROR");
        return { success: false, error: "SDK loading failed: " + err.message };
      }

      // Step 6: Create client
      logDiagnostic("STEP 6: Creating Supabase client", "DEBUG");
      
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

      logDiagnostic("No duplicate found, proceeding with RPC call", "DEBUG");

      // Step 8: Call RPC function instead of direct insert
      logDiagnostic("STEP 8: Calling handle_website_lead_creation RPC", "DEBUG");
      logDiagnostic("=== CHECKPOINT: RPC Call ===", "INFO");
      
      var rpcResult;
      try {
        rpcResult = await client.rpc('handle_website_lead_creation', {
          p_full_name: fullName,
          p_mobile_number: mobile,
          p_city: pincode ? "Pincode: " + pincode : null,
          p_lead_source: leadSource,
          p_pincode: pincode,
          p_family_members: membersStr,
          p_medical_info: medStr,
          p_notes: notesStr
        });
        
        logDiagnostic("RPC call completed", "DEBUG");
        logDiagnostic("Result: error=" + (rpcResult.error ? "YES" : "NO") + ", data=" + (rpcResult.data ? "YES" : "NO"), "DEBUG");
      } catch (err) {
        logDiagnostic("ERROR: RPC call failed: " + err.message, "ERROR");
        return { success: false, error: "RPC call failed: " + err.message };
      }

      if (rpcResult.error) {
        logDiagnostic("ERROR: RPC returned error: " + rpcResult.error.message, "ERROR");
        return { success: false, error: "RPC failed: " + rpcResult.error.message };
      }

      // Parse RPC response
      var responseData = rpcResult.data;
      if (!responseData || !responseData.success) {
        logDiagnostic("ERROR: RPC returned success=false", "ERROR");
        if (responseData && responseData.error) {
          logDiagnostic("RPC error details: " + responseData.error, "ERROR");
        }
        return { success: false, error: "Lead creation failed in RPC" };
      }

      var leadId = responseData.lead_id;
      logDiagnostic("*** LEAD CREATED SUCCESSFULLY VIA RPC ***", "INFO");
      logDiagnostic("Lead ID: " + leadId, "INFO");
      logDiagnostic("=== ALL STEPS COMPLETED SUCCESSFULLY ===", "INFO");
      
      return {
        success: true,
        lead_id: leadId,
        full_name: fullName,
        mobile_number: mobile
      };

    } catch (err) {
      logDiagnostic("=== UNEXPECTED ERROR ===", "ERROR");
      logDiagnostic("Error message: " + err.message, "ERROR");
      
      setTimeout(function() {
        showDiagnosticPanel();
      }, 500);
      
      return { success: false, error: "Unexpected error: " + err.message };
    }
  }

  // ============================================================================
  // DIAGNOSTIC PANEL (same as before)
  // ============================================================================
  function showDiagnosticPanel() {
    logDiagnostic("showDiagnosticPanel() called", "DEBUG");
    var panel = document.createElement("div");
    panel.id = "crm-diagnostic-panel";
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
    `;
    
    var header = document.createElement("div");
    header.style.cssText = "padding: 12px 15px; background: #f0f0f0; border-bottom: 1px solid #ddd;";
    header.innerHTML = "<div style='font-weight: bold;'>📊 DIAGNOSTIC RESULTS</div>";
    panel.appendChild(header);
    
    var logsDiv = document.createElement("div");
    logsDiv.style.cssText = "flex: 1; overflow-y: auto; padding: 12px 15px; background: #fafafa; font-size: 11px; white-space: pre-wrap; word-break: break-word;";
    logsDiv.textContent = window.diagnosticLogs.join("\n");
    panel.appendChild(logsDiv);
    
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ CLOSE";
    closeBtn.style.cssText = "padding: 10px; background: #6c757d; color: white; border: none; cursor: pointer;";
    closeBtn.onclick = function() {
      if (document.body.contains(panel)) {
        document.body.removeChild(panel);
      }
    };
    panel.appendChild(closeBtn);
    
    document.body.appendChild(panel);
    logDiagnostic("Diagnostic panel displayed", "DEBUG");
  }

  // ============================================================================
  // EXPOSE FUNCTION TO GLOBAL SCOPE
  // ============================================================================
  window.saveWebsiteLead = saveWebsiteLead;
  logDiagnostic("window.saveWebsiteLead exposed globally", "DEBUG");
  logDiagnostic("=== INITIALIZATION COMPLETE ===", "INFO");
})();
