document.addEventListener('DOMContentLoaded', function() {
    const scrapeBtn = document.getElementById('scrapeCurrent');
    const searchBtn = document.getElementById('searchGoogle');
    const exportBtn = document.getElementById('exportCSV');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    
    let contacts = JSON.parse(localStorage.getItem('videographerContacts') || '[]');
    
    // Scrape current page
    scrapeBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                func: scrapePage
            }, (results) => {
                const newContacts = results[0]?.result || [];
                if (newContacts.length > 0) {
                    contacts = contacts.concat(newContacts);
                    localStorage.setItem('videographerContacts', JSON.stringify(contacts));
                    showResults(newContacts);
                    showStatus(`Found ${newContacts.length} contacts!`, 'success');
                } else {
                    showStatus('No contacts found on this page', 'error');
                }
            });
        });
    });
    
    // Search Google
    searchBtn.addEventListener('click', function() {
        const location = document.getElementById('location').value;
        const type = document.getElementById('searchType').value;
        
        if (!location) {
            showStatus('Please enter a location', 'error');
            return;
        }
        
        const query = encodeURIComponent(`${type} ${location} videography services contact`);
        const url = `https://www.google.com/search?q=${query}`;
        
        chrome.tabs.create({ url: url });
        showStatus('Google search opened. Visit results and click "Extract from Current Page"', 'info');
    });
    
    // Export CSV
    exportBtn.addEventListener('click', function() {
        if (contacts.length === 0) {
            showStatus('No contacts to export', 'error');
            return;
        }
        
        const headers = ['Name', 'Email', 'Phone', 'Website', 'Location'];
        const csvContent = [
            headers.join(','),
            ...contacts.map(c => [
                `"${c.name || ''}"`,
                `"${c.email || ''}"`,
                `"${c.phone || ''}"`,
                `"${c.website || ''}"`,
                `"${c.location || ''}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `videographer_contacts_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        showStatus(`Exported ${contacts.length} contacts`, 'success');
    });
    
    // Helper functions
    function showStatus(message, type) {
        statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
    }
    
    function showResults(contacts) {
        resultsDiv.innerHTML = '<h3>New Contacts Found:</h3>';
        contacts.forEach(c => {
            const div = document.createElement('div');
            div.className = 'result';
            div.innerHTML = `
                <strong>${c.name || 'Unknown'}</strong><br>
                ${c.email ? '📧 ' + c.email + '<br>' : ''}
                ${c.phone ? '📞 ' + c.phone + '<br>' : ''}
                ${c.website ? '🌐 ' + c.website : ''}
            `;
            resultsDiv.appendChild(div);
        });
    }
    
    // Show stored contacts count
    if (contacts.length > 0) {
        showStatus(`You have ${contacts.length} saved contacts`, 'info');
    }
});

// Function to scrape page (will be injected)
function scrapePage() {
    const emails = document.body.innerHTML.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const phones = document.body.innerHTML.match(/(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g) || [];
    
    const pageText = document.body.textContent.toLowerCase();
    const isVideographer = pageText.includes('videographer') || 
                          pageText.includes('cinematography') ||
                          pageText.includes('wedding video') ||
                          /video\s+(production|services)/i.test(pageText);
    
    if (!isVideographer && emails.length === 0) {
        return [];
    }
    
    const contacts = [];
    const url = window.location.href;
    const title = document.title;
    
    emails.forEach(email => {
        contacts.push({
            name: title.split('|')[0].split('-')[0].trim().substring(0, 50),
            email: email,
            phone: phones[0] || null,
            website: url,
            location: extractLocation(pageText),
            source: 'webpage'
        });
    });
    
    if (contacts.length === 0 && isVideographer) {
        contacts.push({
            name: title.split('|')[0].split('-')[0].trim(),
            email: null,
            phone: phones[0] || null,
            website: url,
            location: extractLocation(pageText),
            source: 'webpage'
        });
    }
    
    return contacts;
    
    function extractLocation(text) {
        // Simple location extraction
        const locationPatterns = [
            /\b(\w+),\s*(\w{2})\b/,  // City, State
            /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,  // "in City"
            /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+videographer\b/i  // "City videographer"
        ];
        
        for (const pattern of locationPatterns) {
            const match = text.match(pattern);
            if (match) return match[1] || match[0];
        }
        return null;
    }
}
