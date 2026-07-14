import { CheckboxField, Field, FormSection, Input, Select, Textarea } from "@/components/ui/form";

type EditorPipeline = {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
};

type EditorField = {
  label: string;
  name: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  options: unknown;
  defaultValue: string | null;
};

type EditorForm = {
  name: string;
  slug: string;
  description: string | null;
  pipelineId: string;
  initialStageId: string;
  successMessage: string;
  redirectUrl: string | null;
  consentText: string | null;
  createFollowUpTask: boolean;
  followUpTaskDelayHours: number;
  webhookEnabled: boolean;
  isActive: boolean;
  fields: EditorField[];
};

const defaults: EditorField[] = [
  { label: "Nom", name: "firstName", type: "TEXT", required: true, placeholder: "El teu nom", options: [], defaultValue: null },
  { label: "Cognoms", name: "lastName", type: "TEXT", required: false, placeholder: "Els teus cognoms", options: [], defaultValue: null },
  { label: "Correu electrònic", name: "email", type: "EMAIL", required: true, placeholder: "nom@empresa.cat", options: [], defaultValue: null },
  { label: "Telèfon", name: "phone", type: "PHONE", required: false, placeholder: "+34…", options: [], defaultValue: null },
  { label: "Empresa", name: "companyName", type: "TEXT", required: false, placeholder: "Nom de l’empresa", options: [], defaultValue: null },
];

function optionsText(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "";
}

export function FormEditor({ pipelines, form }: { pipelines: EditorPipeline[]; form?: EditorForm }) {
  const selectedPipelineId = form?.pipelineId ?? pipelines[0]?.id;
  const selectedStageId = form?.initialStageId ?? pipelines[0]?.stages[0]?.id;
  const rows = Array.from({ length: 10 }, (_, index) => form?.fields[index] ?? defaults[index] ?? null);

  return (
    <>
      <FormSection title="Identitat" description="Nom intern, URL pública i textos principals.">
        <Field label="Nom" htmlFor="name" required><Input id="name" name="name" defaultValue={form?.name} required autoFocus /></Field>
        <Field label="Identificador URL" htmlFor="slug" hint="Només lletres, números i guions."><Input id="slug" name="slug" defaultValue={form?.slug} placeholder="demanar-una-demo" /></Field>
        <Field className="form-field--full" label="Descripció" htmlFor="description"><Textarea id="description" name="description" defaultValue={form?.description ?? ""} rows={3} /></Field>
        <Field className="form-field--full" label="Missatge de confirmació" htmlFor="successMessage" required><Textarea id="successMessage" name="successMessage" defaultValue={form?.successMessage ?? "Gràcies. Hem rebut la teva sol·licitud."} rows={2} required /></Field>
        <Field label="URL de redirecció" htmlFor="redirectUrl"><Input id="redirectUrl" name="redirectUrl" type="url" defaultValue={form?.redirectUrl ?? ""} placeholder="https://" /></Field>
        <Field label="Text de consentiment" htmlFor="consentText"><Input id="consentText" name="consentText" defaultValue={form?.consentText ?? ""} /></Field>
      </FormSection>

      <FormSection title="Destinació comercial" description="On es crearà l’oportunitat de cada enviament.">
        <Field label="Pipeline" htmlFor="pipelineId" required>
          <Select id="pipelineId" name="pipelineId" defaultValue={selectedPipelineId} required>
            {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          </Select>
        </Field>
        <Field label="Etapa inicial" htmlFor="initialStageId" required>
          <Select id="initialStageId" name="initialStageId" defaultValue={selectedStageId} required>
            {pipelines.map((pipeline) => <optgroup key={pipeline.id} label={pipeline.name}>{pipeline.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</optgroup>)}
          </Select>
        </Field>
        <Field label="Retard de la tasca (hores)" htmlFor="followUpTaskDelayHours"><Input id="followUpTaskDelayHours" name="followUpTaskDelayHours" type="number" min="1" max="8760" defaultValue={form?.followUpTaskDelayHours ?? 24} /></Field>
        <div className="form-field">
          <CheckboxField name="createFollowUpTask" label="Crea una tasca de seguiment" defaultChecked={form?.createFollowUpTask ?? true} />
          <CheckboxField name="webhookEnabled" label="Publica l’esdeveniment webhook" defaultChecked={form?.webhookEnabled ?? true} />
          <CheckboxField name="isActive" label="Formulari actiu" description="Només els formularis actius accepten enviaments." defaultChecked={form?.isActive ?? false} />
        </div>
      </FormSection>

      <FormSection title="Camps" description="Configura fins a deu camps. Deixa la fila buida per ignorar-la.">
        <div className="form-field--full" style={{ display: "grid", gap: 14 }}>
          {rows.map((field, index) => (
            <div className="ui-card" key={index} style={{ padding: 16 }}>
              <div className="form-grid">
                <Field label={`Etiqueta ${index + 1}`} htmlFor={`field_${index}_label`}><Input id={`field_${index}_label`} name={`field_${index}_label`} defaultValue={field?.label ?? ""} /></Field>
                <Field label="Nom intern" htmlFor={`field_${index}_name`}><Input id={`field_${index}_name`} name={`field_${index}_name`} defaultValue={field?.name ?? ""} placeholder="campPersonalitzat" /></Field>
                <Field label="Tipus" htmlFor={`field_${index}_type`}>
                  <Select id={`field_${index}_type`} name={`field_${index}_type`} defaultValue={field?.type ?? "TEXT"}>
                    <option value="TEXT">Text</option><option value="EMAIL">Correu</option><option value="PHONE">Telèfon</option><option value="TEXTAREA">Text llarg</option><option value="NUMBER">Número</option><option value="SELECT">Selecció</option><option value="CHECKBOX">Casella</option><option value="HIDDEN">Ocult</option>
                  </Select>
                </Field>
                <Field label="Placeholder" htmlFor={`field_${index}_placeholder`}><Input id={`field_${index}_placeholder`} name={`field_${index}_placeholder`} defaultValue={field?.placeholder ?? ""} /></Field>
                <Field label="Opcions" htmlFor={`field_${index}_options`} hint="Separades per comes; només per a camps de selecció."><Input id={`field_${index}_options`} name={`field_${index}_options`} defaultValue={optionsText(field?.options)} /></Field>
                <Field label="Valor per defecte" htmlFor={`field_${index}_defaultValue`}><Input id={`field_${index}_defaultValue`} name={`field_${index}_defaultValue`} defaultValue={field?.defaultValue ?? ""} /></Field>
                <CheckboxField name={`field_${index}_required`} value="true" label="Camp obligatori" defaultChecked={field?.required ?? false} />
              </div>
            </div>
          ))}
        </div>
      </FormSection>
    </>
  );
}
