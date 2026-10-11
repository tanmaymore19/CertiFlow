import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { CertificateProject } from '../types/certificate';
import { saveLocalTemplate, getLocalTemplate } from './storageHelper';

const COLLECTION_NAME = 'projects';

export async function fetchUserProjects(_userId?: string): Promise<CertificateProject[]> {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(colRef);
    const projects: CertificateProject[] = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as CertificateProject;
      if (data.template && !data.template.dataUrl) {
        const localDataUrl = await getLocalTemplate(docSnap.id);
        if (localDataUrl) {
          data.template.dataUrl = localDataUrl;
        }
      }
      projects.push({ ...data, id: docSnap.id });
    }

    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  }
}

export async function saveProject(project: CertificateProject): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${project.id}`;
  try {
    const projectToSave: CertificateProject = {
      ...project,
      updatedAt: new Date().toISOString(),
    };

    if (project.template?.dataUrl) {
      await saveLocalTemplate(project.id, project.template.dataUrl);
      if (project.template.dataUrl.length > 400000) {
        projectToSave.template = {
          ...project.template,
          dataUrl: '',
        };
      }
    }

    if (projectToSave.recipients && projectToSave.recipients.length > 200) {
      projectToSave.recipients = projectToSave.recipients.slice(0, 200);
    }

    await setDoc(doc(db, COLLECTION_NAME, project.id), projectToSave);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${projectId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
