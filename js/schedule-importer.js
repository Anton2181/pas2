// Schedule Importer Script
// Parses raw CSV data and aggregates it into the schedule format

const RAW_CSV_DATA = `Week,Day,Time,TODO,Date,DESCRIPTION,Assignee,TOPIC,NOTES,EFFORT
10,,All,Planning of the Month / Teachers and Assistants,01/12/2025,Planning of all Teachers and Assistants shifts for the next month. Send a reminder each week about the next week assistant/teachers schedule. Make sure that all the teachers and assistans fill the avaiability of the next month,,,,"1,5"
10,,All,Planning of the Month / Registrations,01/12/2025,Planning of all Registrations shifts for the next month. Send a reminder each week about the next week registration schedule. ,,,,"0,5"
10,,All,Planning of the Month / Master of Cerimony,01/12/2025,"Planning of all Master of Cerimony shifts for the next month, including practicas and Milongas. Send a reminder each week about the next week Master of Cerimony schedule. ",,,,"0,5"
10,,All,Planning of the Month / Food Supply,01/12/2025,Planning of all Groceries shifts for the next month. Send a reminder each week about the next week groceries schedule. ,,,,"0,5"
10,,All,Monthly Monitoring,01/12/2025,Check weekly the status of finances to make sure that the Project is on Plus,,,,2
10,,All,Monthly Report,01/12/2025,"Prepare the Montlhy report to make the presentation during the team Meeting, check the attendence of the month and give to the care team the names of people to be contacted (lost)",,,,2
10,,All,Monthly Print,01/12/2025,"Print all the invoices and recepit, give to Daniele the recepit for storage",,,,"0,5"
10,,All,Monthly Payments,01/12/2025,Pay all the bills and invoices received in the month.,,,,1
10,,All,Take Care of Team Members,01/12/2025,"Make sure that the team members are happy and motivated, if there are conflit between members make sure that there is a solutions between people",,,,2
10,,All,CRM Manteince,01/12/2025,"Make sure that the CRM is working, fix all the issue that arise weekly (Problem with registrations, problem with payments, etc)",,,,1
10,,All,Project Management,01/12/2025,"Replying to questions, coordinating Partyka",,,,2
10,Tuesday,20-21,Registrations / Advanced - Tuesday,02/12/2025,"Make sure that all the People are registered on the CRM + are registered on the event and make sure that everyone that enter the room has already payed (cash or Online), collect all the cash at the end of the event and give it to Daniele",,Salon - Vals / Nothing More than a Dream Sacada,,"0,5"
10,Tuesday,20-21,Preparation for the Lesson / Advanced - Tuesday,02/12/2025,Preparing beforehand the Class with the other teacher,Daniele Donzello,Salon - Vals / Nothing More than a Dream Sacada,Advanced,1
10,Tuesday,20-21,Conducting the lesson / Advanced - Tuesday,02/12/2025,"Conducting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson",Daniele Donzello,Salon - Vals / Nothing More than a Dream Sacada,Advanced,"1,5"
10,Tuesday,20-21,Preparation for the Lesson / Advanced - Tuesday,02/12/2025,Preparing beforehand the Class with the other teacher,Yulia Talybova,Salon - Vals / Nothing More than a Dream Sacada,Advanced,1
10,Tuesday,20-21,Conducting the lesson / Advanced - Tuesday,02/12/2025,"Conducting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson",Yulia Talybova,Salon - Vals / Nothing More than a Dream Sacada,Advanced,"1,5"
10,Tuesday,21-22,Registrations / Beginners - Tuesday,02/12/2025,"Make sure that all the People are registered on the CRM + are registered on the event and make sure that everyone that enter the room has already payed (cash or Online), collect all the cash at the end of the event and give it to Daniele",,Sacadas,,"0,5"
10,Tuesday,21-22,Registrations / Beginners - Tuesday,02/12/2025,"Make sure that all the People are registered on the CRM + are registered on the event and make sure that everyone that enter the room has already payed (cash or Online), collect all the cash at the end of the event and give it to Daniele",,Sacadas,,"0,5"
10,Tuesday,21-22,Registrations / Beginners - Tuesday,02/12/2025,"Make sure that all the People are registered on the CRM + are registered on the event and make sure that everyone that enter the room has already payed (cash or Online), collect all the cash at the end of the event and give it to Daniele",,Sacadas,,"0,5"
10,Tuesday,21-22,Preparation for the Lesson / Beginners - Tuesday,02/12/2025,Preparing beforehand the Class with the other teacher,Daniele Donzello,Sacadas,Beginner LVL 2,1
10,Tuesday,21-22,Conducting the lesson / Beginners - Tuesday,02/12/2025,"Conducting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson",Daniele Donzello,Sacadas,Beginner LVL 2,"1,5"
10,Tuesday,21-22,Preparation for the Lesson / Beginners - Tuesday,02/12/2025,Preparing beforehand the Class with the other teacher,Yulia Talybova,Sacadas,Beginner LVL 2,1
10,Tuesday,21-22,Conducting the lesson / Beginners - Tuesday,02/12/2025,"Conducting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson",Yulia Talybova,Sacadas,Beginner LVL 2,"1,5"
10,Tuesday,21-22,Assisting the lesson - Tuesday,02/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Sacadas,Beginner LVL 2,"1,5"
10,Tuesday,21-22,Assisting the lesson - Tuesday,02/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Sacadas,Beginner LVL 2,"1,5"
10,Tuesday,21-22,Preparation for the Lesson / Assistant - Tuesday,02/12/2025,Preparing beforehand the Class with the other Assitant,,Sacadas,Beginner LVL 2,1
10,Tuesday,21-22,Assisting the lesson - Tuesday,02/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Sacadas,Beginner LVL 2,"1,5"
10,Tuesday,21-22,Preparation for the Lesson / Assistant - Tuesday,02/12/2025,Preparing beforehand the Class with the other Assitant,,Sacadas,Beginner LVL 2,1
10,Tuesday,21-22,Assisting the lesson - Tuesday,02/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Sacadas,Beginner LVL 2,"1,5"
10,Wednesday,21-22,Preparation for the Lesson / Teachers - Wednesday,03/12/2025,Preparing beforehand the Class with the other teacher,,Turning on the right after Ocho Atras,Beginner LVL 1,1
10,Wednesday,21-22,Assisting the lesson - Wednesday,03/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Turning on the right after Ocho Atras,Beginner LVL 1,"1,5"
10,Wednesday,21-22,Assisting the lesson - Wednesday,03/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Turning on the right after Ocho Atras,Beginner LVL 1,"1,5"
10,Wednesday,All,Food Supply - Wednesday,03/12/2025,Make Groceries before the event, during the event make sure that the food / drinks are always served and present. After each groceries send the Recepit to the Finance Team to have the refund,,No Pinapple on Pizza when Daniele is present at the party,,1
11,Tuesday,21-22,Preparation for the Lesson / Assistant - Tuesday,09/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Giro with Sacadas,Beginner LVL 2,"1,5"
11,Wednesday,20-21,Conducting the lesson / Intermediate - Wednesday,10/12/2025,Conducting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson,,How to become a Giro,Intermediate,"1,5"
11,Wednesday,21-22,Assisting the lesson - Wednesday,10/12/2025,"Assosting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson. ""Helping teachers in instructing participants, especially during excercises.
If needed, helping in class organization, including check-ins, money collection.
Keeping attention and letting the teachers know in case of organizational issues.
Active participation in scheduled classes i.e.: at least 2 times a month.",,Close Embrace,Beginner LVL 1,"1,5"
12,Tuesday,All,Photographer / Videomaker - Tuesday,16/12/2025,During the event make Pictures and Videos and send it to the Social Media Manager for making the post,,,1
12,Wednesday,20-21,Registrations / Intermediate - Wednesday,17/12/2025,Make sure that all the People are registered on the CRM + are registered on the event and make sure that everyone that enter the room has already payed (cash or Online), collect all the cash at the end of the event and give it to Daniele,,"End of the semester? That went fast…
","0,5"
12,Wednesday,20-21,Registrations / Intermediate - Wednesday,17/12/2025,Make sure that all the People are registered on the CRM + are registered on the event and make sure that everyone that enter the room has already payed (cash or Online), collect all the cash at the end of the event and give it to Daniele,,"End of the semester? That went fast…
","0,5"
12,Wednesday,20-21,Preparation for the Lesson / Intermediate - Wednesday,17/12/2025,Preparing beforehand the Class with the other teacher,,"End of the semester? That went fast…
",Intermediate,1
12,Wednesday,20-21,Conducting the lesson / Intermediate - Wednesday,17/12/2025,Conducting the lesson, arrive 15 mins before the lesson and leave not before 15 mins after the lesson,,"End of the semester? That went fast…
",Intermediate,"1,5"`;

// CSV Parsing Logic
function parseCSV(csv) {
    const lines = [];
    let currentLine = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentCell || currentLine.length > 0) {
                currentLine.push(currentCell.trim());
                lines.push(currentLine);
            }
            currentLine = [];
            currentCell = '';
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentLine.length > 0) {
        currentLine.push(currentCell.trim());
        lines.push(currentLine);
    }
    return lines;
}

// Main Import Logic
function importSchedule() {
    const rows = parseCSV(RAW_CSV_DATA);
    const headers = rows[0];
    const dataRows = rows.slice(1);

    const weekIdx = headers.findIndex(h => h.toLowerCase().includes('week'));
    const dayIdx = headers.findIndex(h => h.toLowerCase().includes('day'));
    const timeIdx = headers.findIndex(h => h.toLowerCase().includes('time'));
    const todoIdx = headers.findIndex(h => h.toLowerCase().includes('todo'));
    const effortIdx = headers.findIndex(h => h.toLowerCase().includes('effort'));

    // 1. Group by Week and Day
    const schedule = {};

    dataRows.forEach(row => {
        const week = row[weekIdx];
        const day = row[dayIdx] || '0th Day'; // Default to 0th Day if empty
        const time = row[timeIdx];
        const name = row[todoIdx];
        const effortStr = row[effortIdx] || '0';
        const effort = parseFloat(effortStr.replace(',', '.'));

        if (!week) return;

        if (!schedule[week]) schedule[week] = {};
        if (!schedule[week][day]) schedule[week][day] = [];

        schedule[week][day].push({
            name,
            time,
            effort,
            originalRow: row
        });
    });

    // 2. Get Groups from LocalStorage
    let groups = [];
    try {
        const workspaceStr = localStorage.getItem('workspace_autosave');
        if (workspaceStr) {
            const workspace = JSON.parse(workspaceStr);
            groups = workspace.state.groups || [];
            // Also need to know what tasks are in each group
            const canvasTasks = workspace.state.canvasTasks || [];

            groups.forEach(group => {
                group.tasks = canvasTasks.filter(t => t.groupId === group.id).map(t => t.name);
                // Determine if group has repeats (duplicate task names)
                const uniqueNames = new Set(group.tasks);
                group.hasRepeats = uniqueNames.size !== group.tasks.length;
            });
        }
    } catch (e) {
        console.error('Error loading groups', e);
    }

    // Sort groups: No repeats first
    groups.sort((a, b) => {
        if (a.hasRepeats === b.hasRepeats) return 0;
        return a.hasRepeats ? 1 : -1;
    });

    // 3. Aggregate
    const finalSchedule = [];

    Object.keys(schedule).sort((a, b) => parseInt(a) - parseInt(b)).forEach(weekNum => {
        const weekData = {
            week: `Week ${weekNum}`,
            days: []
        };

        const days = ['0th Day', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        days.forEach(dayName => {
            if (!schedule[weekNum][dayName]) return;

            const dayTasks = schedule[weekNum][dayName];
            const processedTasks = [];
            const usedIndices = new Set();

            // Try to match groups
            groups.forEach(group => {
                if (!group.tasks || group.tasks.length === 0) return;

                // Check if day has all tasks for this group
                // We need to match counts as well
                const groupTaskCounts = {};
                group.tasks.forEach(t => groupTaskCounts[t] = (groupTaskCounts[t] || 0) + 1);

                const dayTaskCounts = {};
                dayTasks.forEach((t, idx) => {
                    if (usedIndices.has(idx)) return;
                    dayTaskCounts[t.name] = (dayTaskCounts[t.name] || 0) + 1;
                });

                let canMatch = true;
                for (const [tName, count] of Object.entries(groupTaskCounts)) {
                    if ((dayTaskCounts[tName] || 0) < count) {
                        canMatch = false;
                        break;
                    }
                }

                if (canMatch) {
                    // Match found! Consume tasks
                    const matchedTaskIndices = [];
                    const groupTaskNames = [...group.tasks]; // Copy to consume

                    dayTasks.forEach((t, idx) => {
                        if (usedIndices.has(idx)) return;
                        const nameIdx = groupTaskNames.indexOf(t.name);
                        if (nameIdx !== -1) {
                            matchedTaskIndices.push(idx);
                            groupTaskNames.splice(nameIdx, 1);
                        }
                    });

                    // Verify we found all (should be true if logic above is correct)
                    if (groupTaskNames.length === 0) {
                        matchedTaskIndices.forEach(idx => usedIndices.add(idx));

                        // Create Group Task Entry
                        // Aggregate metrics
                        let totalEffort = 0;
                        let times = new Set();
                        matchedTaskIndices.forEach(idx => {
                            const t = dayTasks[idx];
                            totalEffort += t.effort;
                            if (t.time) times.add(t.time);
                        });

                        processedTasks.push({
                            id: `g-${group.id}-${weekNum}-${dayName}-${processedTasks.length}`,
                            name: group.title,
                            color: getGroupColor(group.variant),
                            time: Array.from(times).join(', '),
                            effort: totalEffort,
                            isGroup: true,
                            subTasks: matchedTaskIndices.map(idx => dayTasks[idx])
                        });
                    }
                }
            });

            // Add remaining tasks
            dayTasks.forEach((t, idx) => {
                if (!usedIndices.has(idx)) {
                    processedTasks.push({
                        id: `t-${weekNum}-${dayName}-${idx}`,
                        name: t.name,
                        color: '#e0e0e0', // Default color
                        time: t.time,
                        effort: t.effort
                    });
                }
            });

            weekData.days.push({
                name: dayName,
                type: getDayType(dayName),
                tasks: processedTasks
            });
        });

        finalSchedule.push(weekData);
    });

    return finalSchedule;
}

function getGroupColor(variant) {
    // Match CSS variant colors
    const colors = {
        1: '#E2B49A', // Peach
        2: '#A8C6A3', // Green
        3: '#DBCB96', // Gold
        4: '#9ABDE2', // Blue
        5: '#E29AA8'  // Pink
    };
    return colors[variant] || '#e0e0e0';
}

function getDayType(dayName) {
    if (dayName === '0th Day') return 'zero';
    if (['Saturday', 'Sunday'].includes(dayName)) return 'weekend';
    return 'work';
}

// Expose for browser execution
window.runImport = importSchedule;
