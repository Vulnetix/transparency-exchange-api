export interface TeaIdentifier {
    idType: 'cpe' | 'tei' | 'purl' | 'swid';
    idValue: string;
}

export interface UpdateTeaComponentRequest {
    name?: string;
    barcode?: string;
    sku?: string;
    vendor?: string;
    identifiers?: TeaIdentifier[];
    type?: string;
    namespace?: string;
    version?: string;
    qualifiers?: Record<string, string>[];
    subpath?: string;
}

export interface TeaComponent {
    identifier: string;
    name: string;
    barcode?: string;
    sku?: string;
    vendor?: string;
    identifiers: TeaIdentifier[];
    type: string;
    namespace?: string;
    version?: string;
    qualifiers?: Record<string, string>[];
    subpath?: string;
}

export interface UpdateTeaProductRequest {
    name?: string;
    barcode?: string;
    sku?: string;
    vendorUuid?: string;
    identifiers?: TeaIdentifier[];
    type?: string;
    namespace?: string;
    version?: string;
    qualifiers?: string;
    subpath?: string;
}

export interface TeaProduct {
    identifier: string;
    name: string;
    barcode?: string;
    sku?: string;
    vendorUuid?: string;
    identifiers: TeaIdentifier[];
    type: string;
    namespace?: string;
    version?: string;
    qualifiers?: Record<string, string>[];
    subpath?: string;
    components: string[];
}

export interface UpdateTeaReleaseRequest {
    tag?: string;
    version?: string;
    name?: string;
    description?: string;
    releaseDate?: string;
    validUntilDate?: string;
    prerelease?: boolean;
    draft?: boolean;
}

export interface TeaRelease {
    identifier: string;
    productUuid: string;
    tag: string;
    version?: string;
    name?: string;
    description?: string;
    releaseDate?: string;
    validUntilDate?: string;
    prerelease: boolean;
    draft: boolean;
    components: string[];
}

export interface TeaArtifact {
    name: string;
    downloadUrl: string;
    checksums?: Record<string, string>;
}

export interface TeaLifecycle {
    phase: 'created' | 'in-progress' | 'updated' | 'completed' | 'archived' | 'deprecated';
    name?: string;
    description?: string;
    startedOn?: string;
    completedOn?: string;
    lastUpdated?: string;
}

export interface CreateTeaCollectionRequest {
    releaseIdentifier: string;
    updateReason: {
        type: string;
        comment?: string;
    };
    artifacts?: TeaArtifact[];
}

export interface TeaCollection {
    identifier: string;
    name: string;
    description?: string;
    artifacts?: TeaArtifact[];
    lifecycle?: TeaLifecycle;
    products: string[];
}

export interface CreateTeaComponentRequest {
    productIdentifier: string;
    name: string;
    barcode?: string;
    sku?: string;
    vendor?: string;
    identifiers?: TeaIdentifier[];
    type: string;
    namespace?: string;
    version?: string;
    qualifiers?: Record<string, string>[];
    subpath?: string;
}

export interface CreateTeaProductRequest {
    name: string;
    barcode?: string;
    sku?: string;
    vendorUuid?: string;
    identifiers?: TeaIdentifier[];
    type: string;
    namespace?: string;
    version?: string;
    qualifiers?: Record<string, string>[];
    subpath?: string;
}

export interface CreateTeaReleaseRequest {
    componentIdentifier: string;
    version: string;
    releaseDate: string;
    preRelease?: boolean;
    identifiers?: TeaIdentifier[];
}

export interface UpdateTeaCollectionRequest {
    name?: string;
    description?: string;
    artifacts?: TeaArtifact[];
    lifecycle?: TeaLifecycle;
}
