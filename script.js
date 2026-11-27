"use strict";

const STORAGE_KEY = "healthPatients";
const sections = Array.from(document.querySelectorAll(".container > .section"));
const form = document.getElementById("patientForm");
const patientFields = document.getElementById("patientFields");
const consultationFields = document.getElementById("consultationFields");
const formMessage = document.getElementById("formMessage");
const patients = loadPatients();
let formMode = "register";
let activePatientId = null;

function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function readPatientRecord(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const age = Number(record.age);
    const gender = typeof record.gender === "string" ? record.gender : "";
    const address = typeof record.address === "string" ? record.address.trim() : "";
    let consultations = [];

    if (Array.isArray(record.consultations)) {
        consultations = record.consultations
            .filter(item => item && typeof item.date === "string" && typeof item.concern === "string")
            .map(item => ({ date: item.date, concern: item.concern.trim() }));
    } else if (typeof record.date === "string" && typeof record.concern === "string") {
        consultations = [{ date: record.date, concern: record.concern.trim() }];
    }

    if (!id || !name || !Number.isInteger(age) || age < 0 || age > 120 ||
        !gender || !address || consultations.length === 0) {
        return null;
    }

    return { id, name, age, gender, address, consultations };
}

function loadPatients() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            throw new Error("Saved patient data is not a list.");
        }

        const loaded = parsed.map(readPatientRecord);
        if (loaded.some(patient => patient === null)) {
            throw new Error("One or more saved patient records are invalid.");
        }

        return loaded;
    } catch (error) {
        window.addEventListener("DOMContentLoaded", function() {
            showAppMessage(`Saved records could not be loaded: ${error.message}`, true);
        }, { once: true });
        return [];
    }
}

function savePatients() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
        return true;
    } catch (error) {
        showAppMessage(`Could not save records to this browser: ${error.message}`, true);
        return false;
    }
}

function showAppMessage(message, isError) {
    const element = document.getElementById("appMessage");
    element.textContent = message;
    element.classList.toggle("error", Boolean(isError));
    element.classList.remove("hidden");
    window.clearTimeout(showAppMessage.timeout);
    showAppMessage.timeout = window.setTimeout(function() {
        element.classList.add("hidden");
    }, 5000);
}

function showFormMessage(message) {
    formMessage.textContent = message;
    formMessage.classList.remove("hidden");
}

function clearFormMessage() {
    formMessage.textContent = "";
    formMessage.classList.add("hidden");
}

function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.toggle("hidden", section.id !== sectionId);
    });

    document.querySelectorAll(".nav-button").forEach(button => {
        const isCurrent = button.dataset.section === sectionId;
        button.classList.toggle("active", isCurrent);
        if (isCurrent) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });

    if (sectionId === "records") {
        displayPatients();
    }
}

function setFormMode(mode, patient) {
    formMode = mode;
    activePatientId = patient ? patient.id : null;
    form.reset();
    clearFormMessage();
    document.getElementById("selectedPatient").classList.add("hidden");
    document.getElementById("cancelButton").classList.toggle("hidden", mode === "register");
    patientFields.classList.toggle("hidden", mode === "consult");
    consultationFields.classList.toggle("hidden", mode === "edit");
    document.getElementById("formTitle").textContent =
        mode === "register" ? "Register a patient" :
        mode === "edit" ? "Edit patient details" : "Record a consultation";
    document.getElementById("saveButton").textContent =
        mode === "register" ? "Register patient" :
        mode === "edit" ? "Save patient details" : "Save consultation";
    document.getElementById("consultationLegend").textContent =
        mode === "register" ? "First consultation" : "Consultation details";

    patientFields.querySelectorAll("input, select").forEach(input => {
        input.required = mode !== "consult";
    });
    document.getElementById("date").required = mode !== "edit";
    document.getElementById("concern").required = mode !== "edit";

    if (patient && mode === "edit") {
        document.getElementById("patientId").value = patient.id;
        document.getElementById("name").value = patient.name;
        document.getElementById("age").value = patient.age;
        document.getElementById("gender").value = patient.gender;
        document.getElementById("address").value = patient.address;
    } else if (patient && mode === "consult") {
        const selectedPatient = document.getElementById("selectedPatient");
        selectedPatient.textContent = `${patient.name} · ID ${patient.id}`;
        selectedPatient.classList.remove("hidden");
    }

    if (mode !== "edit") {
        document.getElementById("date").max = localDateString(new Date());
    }
    showSection("registration");
}

function patientFromForm() {
    return {
        id: document.getElementById("patientId").value.trim(),
        name: document.getElementById("name").value.trim(),
        age: Number(document.getElementById("age").value),
        gender: document.getElementById("gender").value,
        address: document.getElementById("address").value.trim()
    };
}

function validateConsultation(date, concern) {
    if (!date || !concern.trim()) {
        showFormMessage("Enter both the consultation date and health concern.");
        return false;
    }

    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime()) || localDateString(parsedDate) !== date) {
        showFormMessage("Enter a valid consultation date.");
        return false;
    }

    if (date > localDateString(new Date())) {
        showFormMessage("Consultation date cannot be in the future.");
        return false;
    }

    return true;
}

function validatePatient(patient) {
    if (!patient.id || !patient.name || !patient.gender || !patient.address ||
        document.getElementById("age").value.trim() === "") {
        showFormMessage("Complete all required patient details.");
        return false;
    }

    if (!Number.isInteger(patient.age) || patient.age < 0 || patient.age > 120) {
        showFormMessage("Age must be a whole number from 0 to 120.");
        return false;
    }

    const duplicate = patients.some(existing =>
        existing.id.toLocaleLowerCase() === patient.id.toLocaleLowerCase() &&
        existing.id !== activePatientId
    );
    if (duplicate) {
        showFormMessage("That patient ID is already in use. Enter a unique ID.");
        return false;
    }

    return true;
}

form.addEventListener("submit", function(event) {
    event.preventDefault();
    clearFormMessage();

    if (formMode !== "edit" && !validateConsultation(
        document.getElementById("date").value,
        document.getElementById("concern").value
    )) {
        return;
    }

    let targetIndex = patients.findIndex(item => item.id === activePatientId);
    const originalPatient = targetIndex >= 0 ? patients[targetIndex] : null;
    let patient;
    if (formMode !== "consult") {
        patient = patientFromForm();
        if (!validatePatient(patient)) {
            return;
        }
    }

    if (formMode === "register") {
        patient.consultations = [{
            date: document.getElementById("date").value,
            concern: document.getElementById("concern").value.trim()
        }];
        patients.push(patient);
    } else if (formMode === "edit") {
        if (targetIndex < 0) {
            showFormMessage("This patient record is no longer available. Refresh and try again.");
            return;
        }
        patients[targetIndex] = Object.assign({}, patients[targetIndex], patient);
    } else {
        if (targetIndex < 0) {
            showFormMessage("This patient record is no longer available. Refresh and try again.");
            return;
        }
        patients[targetIndex].consultations.push({
            date: document.getElementById("date").value,
            concern: document.getElementById("concern").value.trim()
        });
    }

    if (!savePatients()) {
        if (formMode === "register") {
            patients.pop();
        } else if (formMode === "consult") {
            patients[targetIndex].consultations.pop();
        } else if (formMode === "edit" && originalPatient) {
            patients[targetIndex] = originalPatient;
        }
        return;
    }

    const successMessage = formMode === "register" ? "Patient registered and consultation recorded." :
        formMode === "edit" ? "Patient details updated." : "Consultation recorded.";
    resetForm();
    updateDashboard();
    displayPatients();
    showAppMessage(successMessage, false);
    showSection("records");
});

function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
}

function displayPatients() {
    const table = document.getElementById("patientTable");
    const search = document.getElementById("search").value.trim().toLocaleLowerCase();
    table.replaceChildren();

    const filtered = patients.filter(patient => {
        const searchableValues = [
            patient.id, patient.name, patient.age, patient.gender, patient.address,
            ...patient.consultations.flatMap(item => [item.date, item.concern])
        ];
        return searchableValues.some(value =>
            String(value).toLocaleLowerCase().includes(search)
        );
    });

    document.getElementById("emptyMessage").classList.toggle("hidden", filtered.length > 0);
    document.getElementById("resultCount").textContent =
        `${filtered.length} ${filtered.length === 1 ? "patient" : "patients"} found`;

    filtered.forEach(patient => {
        const row = document.createElement("tr");
        const latestConsultation = patient.consultations[patient.consultations.length - 1];
        appendCell(row, patient.id);
        appendCell(row, patient.name);
        appendCell(row, `${patient.age} · ${patient.gender}`);
        appendCell(row, patient.address);
        appendCell(row, `${latestConsultation.date} — ${latestConsultation.concern}`);

        const historyCell = appendCell(row, "");
        const history = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = `${patient.consultations.length} ${patient.consultations.length === 1 ? "visit" : "visits"}`;
        history.appendChild(summary);
        const historyList = document.createElement("ul");
        historyList.className = "history-list";
        patient.consultations.slice().reverse().forEach(consultation => {
            const item = document.createElement("li");
            const date = document.createElement("strong");
            date.textContent = consultation.date;
            item.appendChild(date);
            item.appendChild(document.createTextNode(` — ${consultation.concern}`));
            historyList.appendChild(item);
        });
        history.appendChild(historyList);
        historyCell.appendChild(history);

        const actions = appendCell(row, "");
        actions.className = "actions-cell";
        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "small-button secondary";
        addButton.textContent = "Add visit";
        addButton.setAttribute("aria-label", `Add consultation for ${patient.name}`);
        addButton.addEventListener("click", () => setFormMode("consult", patient));

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "small-button secondary";
        editButton.textContent = "Edit";
        editButton.setAttribute("aria-label", `Edit ${patient.name}`);
        editButton.addEventListener("click", () => setFormMode("edit", patient));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "small-button danger";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", `Delete ${patient.name}`);
        deleteButton.addEventListener("click", () => deletePatient(patient.id));

        actions.append(addButton, editButton, deleteButton);
        table.appendChild(row);
    });
}

function deletePatient(patientId) {
    const index = patients.findIndex(patient => patient.id === patientId);
    if (index < 0 || !window.confirm(`Delete patient ${patients[index].name} and all of their consultations?`)) {
        return;
    }

    const removed = patients.splice(index, 1)[0];
    if (!savePatients()) {
        patients.splice(index, 0, removed);
        return;
    }
    updateDashboard();
    displayPatients();
    showAppMessage("Patient record and consultation history deleted.", false);
}

function resetForm() {
    setFormMode("register");
}

function updateDashboard() {
    document.getElementById("totalPatients").textContent = patients.length;
    document.getElementById("totalConsultations").textContent =
        patients.reduce((total, patient) => total + patient.consultations.length, 0);
    document.getElementById("malePatients").textContent =
        patients.filter(patient => patient.gender.toLocaleLowerCase() === "male").length;
    document.getElementById("femalePatients").textContent =
        patients.filter(patient => patient.gender.toLocaleLowerCase() === "female").length;
    displayRecentConsultations();
}

function displayRecentConsultations() {
    const list = document.getElementById("recentConsultations");
    const emptyMessage = document.getElementById("recentEmptyMessage");
    const consultations = patients.flatMap(patient =>
        patient.consultations.map(consultation => ({
            patientName: patient.name,
            patientId: patient.id,
            date: consultation.date,
            concern: consultation.concern
        }))
    ).sort((first, second) => second.date.localeCompare(first.date)).slice(0, 5);

    list.replaceChildren();
    emptyMessage.classList.toggle("hidden", consultations.length > 0);

    consultations.forEach(consultation => {
        const item = document.createElement("li");
        const date = document.createElement("time");
        const details = document.createElement("div");
        const patient = document.createElement("strong");
        const concern = document.createElement("p");

        date.dateTime = consultation.date;
        date.textContent = consultation.date;
        patient.textContent = `${consultation.patientName} · ${consultation.patientId}`;
        concern.textContent = consultation.concern;
        details.append(patient, concern);
        item.append(date, details);
        list.appendChild(item);
    });
}

document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => showSection(button.dataset.section));
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        setFormMode("register");
    });
});

document.getElementById("search").addEventListener("input", displayPatients);
document.getElementById("cancelButton").addEventListener("click", resetForm);

document.getElementById("date").max = localDateString(new Date());
updateDashboard();
displayPatients();
