import type { Readable } from "node:stream";

/**
 * Type definition for a Universally Unique Identifier (UUID) using a specific format.
 * @typedef {`${string}-${string}-${string}-${string}-${string}`} UUID
 */
export type UUID = `${string}-${string}-${string}-${string}-${string}`;

/**
 * Helper function to safely cast a string to strongly typed UUID
 * @param id The string UUID to validate and cast
 * @returns The same UUID with branded type information
 */
export function asUUID(id: string): UUID {
	if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
		throw new Error(`Invalid UUID format: ${id}`);
	}
	return id as UUID;
}

/**
 * Represents the content of a memory, message, or other information
 */
export interface Content {
	/** The agent's internal thought process */
	thought?: string;

	/** The agent's plan for the next message */
	plan?: string;

	/** The main text content visible to users */
	text?: string;

	/** Optional actions to be performed */
	actions?: string[];

	/** Optional providers to use for context generation */
	providers?: string[];

	/** Optional source/origin of the content */
	source?: string;

	/** URL of the original message/post (e.g. tweet URL, Discord message link) */
	url?: string;

	/** UUID of parent message if this is a reply/thread */
	inReplyTo?: UUID;

	/** Array of media attachments */
	attachments?: Media[];

	/** 
	 * Additional dynamic properties
	 * Use specific properties above instead of this when possible
	 */
	[key: string]: unknown;
}

/**
 * Example content with associated user for demonstration purposes
 */
export interface ActionExample {
	/** User associated with the example */
	name: string;

	/** Content of the example */
	content: Content;
}

export type ModelType = (typeof ModelTypes)[keyof typeof ModelTypes] | string;

/**
 * Model size/type classification
 */
export const ModelTypes = {
	SMALL: "TEXT_SMALL", // kept for backwards compatibility
	MEDIUM: "TEXT_LARGE", // kept for backwards compatibility
	LARGE: "TEXT_LARGE", // kept for backwards compatibility
	TEXT_SMALL: "TEXT_SMALL",
	TEXT_LARGE: "TEXT_LARGE",
	TEXT_EMBEDDING: "TEXT_EMBEDDING",
	TEXT_TOKENIZER_ENCODE: "TEXT_TOKENIZER_ENCODE",
	TEXT_TOKENIZER_DECODE: "TEXT_TOKENIZER_DECODE",
	TEXT_REASONING_SMALL: "REASONING_SMALL",
	TEXT_REASONING_LARGE: "REASONING_LARGE",
	TEXT_COMPLETION: "TEXT_COMPLETION",
	IMAGE: "IMAGE",
	IMAGE_DESCRIPTION: "IMAGE_DESCRIPTION",
	TRANSCRIPTION: "TRANSCRIPTION",
	TEXT_TO_SPEECH: "TEXT_TO_SPEECH",
	AUDIO: "AUDIO",
	VIDEO: "VIDEO",
	OBJECT_SMALL: "OBJECT_SMALL",
	OBJECT_LARGE: "OBJECT_LARGE",
} as const;

export type ServiceType = (typeof ServiceTypes)[keyof typeof ServiceTypes];

export const ServiceTypes = {
	TRANSCRIPTION: "transcription",
	VIDEO: "video",
	BROWSER: "browser",
	PDF: "pdf",
	REMOTE_FILES: "aws_s3",
	WEB_SEARCH: "web_search",
	EMAIL: "email",
	TEE: "tee",
	TASK: "task",
} as const;

/**
 * Represents the current state/context of a conversation
 */
export interface State {
	/** Additional dynamic properties */
	[key: string]: any;
	values: {
		[key: string]: any;
	};
	data: {
		[key: string]: any;
	};
	text: string;
}

/**
 * Memory type enumeration for built-in memory types
 */
export type MemoryTypeAlias = string;

export enum MemoryType {
	DOCUMENT = "document",
	FRAGMENT = "fragment",
	MESSAGE = "message",
	DESCRIPTION = "description",
	CUSTOM = "custom",
}

export type MemoryScope = "shared" | "private" | "room";

/**
 * Base interface for all memory metadata types
 */
export interface BaseMetadata {
	type: MemoryTypeAlias;
	source?: string;
	sourceId?: UUID;
	scope?: MemoryScope;
	timestamp?: number;
	tags?: string[];
}

export interface DocumentMetadata extends BaseMetadata {
	type: MemoryType.DOCUMENT;
}

export interface FragmentMetadata extends BaseMetadata {
	type: MemoryType.FRAGMENT;
	documentId: UUID;
	position: number;
}

export interface MessageMetadata extends BaseMetadata {
	type: MemoryType.MESSAGE;
}

export interface DescriptionMetadata extends BaseMetadata {
	type: MemoryType.DESCRIPTION;
}

export interface CustomMetadata extends BaseMetadata {
	type: MemoryTypeAlias;
	[key: string]: unknown;
}

export type MemoryMetadata =
	| DocumentMetadata
	| FragmentMetadata
	| MessageMetadata
	| DescriptionMetadata
	| CustomMetadata;

/**
 * Represents a stored memory/message
 */
export interface Memory {
	/** Optional unique identifier */
	id?: UUID;

	/** Associated user ID */
	entityId: UUID;

	/** Associated agent ID */
	agentId?: UUID;

	/** Optional creation timestamp in milliseconds since epoch */
	createdAt?: number;

	/** Memory content */
	content: Content;

	/** Optional embedding vector for semantic search */
	embedding?: number[];

	/** Associated room ID */
	roomId: UUID;

	/** Whether memory is unique (used to prevent duplicates) */
	unique?: boolean;

	/** Embedding similarity score (set when retrieved via search) */
	similarity?: number;

	/** Metadata for the memory */
	metadata?: MemoryMetadata;
}

/**
 * Example message for demonstration
 */
export interface MessageExample {
	/** Associated user */
	name: string;

	/** Message content */
	content: Content;
}

/**
 * Handler function type for processing messages
 */
export type Handler = (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
	options?: { [key: string]: unknown },
	callback?: HandlerCallback,
	responses?: Memory[],
) => Promise<unknown>;

/**
 * Callback function type for handlers
 */
export type HandlerCallback = (
	response: Content,
	files?: any,
) => Promise<Memory[]>;

/**
 * Validator function type for actions/evaluators
 */
export type Validator = (
	runtime: IAgentRuntime,
	message: Memory,
	state?: State,
) => Promise<boolean>;

/**
 * Represents an action the agent can perform
 */
export interface Action {
	/** Similar action descriptions */
	similes?: string[];

	/** Detailed description */
	description: string;

	/** Example usages */
	examples?: ActionExample[][];

	/** Handler function */
	handler: Handler;

	/** Action name */
	name: string;

	/** Validation function */
	validate: Validator;
}

/**
 * Example for evaluating agent behavior
 */
export interface EvaluationExample {
	/** Evaluation context */
	prompt: string;

	/** Example messages */
	messages: Array<ActionExample>;

	/** Expected outcome */
	outcome: string;
}

/**
 * Evaluator for assessing agent responses
 */
export interface Evaluator {
	/** Whether to always run */
	alwaysRun?: boolean;

	/** Detailed description */
	description: string;

	/** Similar evaluator descriptions */
	similes?: string[];

	/** Example evaluations */
	examples: EvaluationExample[];

	/** Handler function */
	handler: Handler;

	/** Evaluator name */
	name: string;

	/** Validation function */
	validate: Validator;
}

export interface ProviderResult {
	values?: {
		[key: string]: any;
	};
	data?: {
		[key: string]: any;
	};
	text?: string;
}

/**
 * Provider for external data/services
 */
export interface Provider {
	/** Provider name */
	name: string;

	/** Description of the provider */
	description?: string;

	/** Whether the provider is dynamic */
	dynamic?: boolean;

	/** Position of the provider in the provider list, positive or negative */
	position?: number;

	/**
	 * Whether the provider is private
	 *
	 * Private providers are not displayed in the regular provider list, they have to be called explicitly
	 */
	private?: boolean;

	/** Data retrieval function */
	get: (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
	) => Promise<ProviderResult>;
}

/**
 * Represents a relationship between users
 */
export interface Relationship {
	/** Unique identifier */
	id: UUID;

	/** First user ID */
	sourceEntityId: UUID;

	/** Second user ID */
	targetEntityId: UUID;

	/** Agent ID */
	agentId: UUID;

	/** Tags for filtering/categorizing relationships */
	tags: string[];

	/** Additional metadata about the relationship */
	metadata: {
		[key: string]: any;
	};

	/** Optional creation timestamp */
	createdAt?: string;
}

export interface Component {
	id: UUID;
	entityId: UUID;
	agentId: UUID;
	roomId: UUID;
	worldId: UUID;
	sourceEntityId: UUID;
	type: string;
	data: {
		[key: string]: any;
	};
}

/**
 * Represents a user account
 */
export interface Entity {
	/** Unique identifier, optional on creation */
	id?: UUID;

	/** Names of the entity */
	names: string[];

	/** Optional additional metadata */
	metadata?: { [key: string]: any };

	/** Agent ID this account is related to, for agents should be themselves */
	agentId: UUID;

	/** Optional array of components */
	components?: Component[];
}

export type World = {
	id: UUID;
	name?: string;
	agentId: UUID;
	serverId: string;
	metadata?: {
		ownership?: {
			ownerId: string;
		};
		roles?: {
			[entityId: UUID]: Role;
		};
		[key: string]: unknown;
	};
};

export type Room = {
	id: UUID;
	name?: string;
	agentId?: UUID;
	source: string;
	type: ChannelType;
	channelId?: string;
	serverId?: string;
	worldId?: UUID;
	metadata?: Record<string, unknown>;
};

/**
 * Room participant with account details
 */
export interface Participant {
	/** Unique identifier */
	id: UUID;

	/** Associated account */
	entity: Entity;
}

/**
 * Represents a media attachment
 */
export type Media = {
	/** Unique identifier */
	id: string;

	/** Media URL */
	url: string;

	/** Media title */
	title: string;

	/** Media source */
	source: string;

	/** Media description */
	description: string;

	/** Text content */
	text: string;

	/** Content type */
	contentType?: string;
};

export enum ChannelType {
	SELF = "SELF",
	DM = "DM",
	GROUP = "GROUP",
	VOICE_DM = "VOICE_DM",
	VOICE_GROUP = "VOICE_GROUP",
	FEED = "FEED",
	THREAD = "THREAD",
	WORLD = "WORLD",
	API = "API",
	FORUM = "FORUM",
}

/**
 * Client instance
 */
export abstract class Service {
	/** Runtime instance */
	protected runtime!: IAgentRuntime;

	constructor(runtime?: IAgentRuntime) {
		if (runtime) {
			this.runtime = runtime;
		}
	}

	abstract stop(): Promise<void>;

	/** Service type */
	static serviceType: string;

	/** Service name */
	abstract capabilityDescription: string;

	/** Service configuration */
	config?: { [key: string]: any };

	/** Start service connection */
	static async start(_runtime: IAgentRuntime): Promise<Service> {
		throw new Error("Not implemented");
	}

	/** Stop service connection */
	static async stop(_runtime: IAgentRuntime): Promise<unknown> {
		throw new Error("Not implemented");
	}
}

export type Route = {
	type: "GET" | "POST" | "PUT" | "DELETE" | "STATIC";
	path: string;
	filePath?: string;
	handler?: (req: any, res: any, runtime: IAgentRuntime) => Promise<void>;
};

/**
 * Plugin for extending agent functionality
 */
export interface Plugin {
	name: string;
	description: string;

	// Initialize plugin with runtime services
	init?: (
		config: Record<string, string>,
		runtime: IAgentRuntime,
	) => Promise<void>;

	// Configuration
	config?: { [key: string]: any };

	// Core plugin components
	memoryManagers?: IMemoryManager[];

	services?: (typeof Service)[];

	// Entity component definitions
	componentTypes?: {
		name: string;
		schema: Record<string, unknown>;
		validator?: (data: any) => boolean;
	}[];

	// Optional plugin features
	actions?: Action[];
	providers?: Provider[];
	evaluators?: Evaluator[];
	adapter?: IDatabaseAdapter;
	models?: {
		[key: string]: (...args: any[]) => Promise<any>;
	};
	events?: {
		[K in keyof EventPayloadMap]?: EventHandler<K>[];
	} & {
		[key: string]: ((params: EventPayload) => Promise<any>)[];
	};
	routes?: Route[];
	tests?: TestSuite[];
}

export interface ProjectAgent {
	character: Character;
	init?: (runtime: IAgentRuntime) => Promise<void>;
	plugins?: Plugin[];
	tests?: TestSuite | TestSuite[];
}

export interface Project {
	agents: ProjectAgent[];
}

export type TemplateType =
	| string
	| ((options: { state: State | { [key: string]: string } }) => string);

/**
 * Configuration for an agent character
 */
export interface Character {
	/** Optional unique identifier */
	id?: UUID;

	/** Character name */
	name: string;

	/** Optional username */
	username?: string;

	/** Optional system prompt */
	system?: string;

	/** Optional prompt templates */
	templates?: {
		[key: string]: TemplateType;
	};

	/** Character biography */
	bio: string | string[];

	/** Example messages */
	messageExamples?: MessageExample[][];

	/** Example posts */
	postExamples?: string[];

	/** Known topics */
	topics?: string[];

	/** Character traits */
	adjectives?: string[];

	/** Optional knowledge base */
	knowledge?: (string | { path: string; shared?: boolean })[];

	/** Available plugins */
	plugins?: string[];

	/** Optional configuration */
	settings?: {
		[key: string]: any | string | boolean | number;
	};

	/** Optional secrets */
	secrets?: {
		[key: string]: string | boolean | number;
	};

	/** Writing style guides */
	style?: {
		all?: string[];
		chat?: string[];
		post?: string[];
	};
}

export interface Agent extends Character {
	createdAt: number;
	updatedAt: number;
}

/**
 * Interface for database operations
 */
export interface IDatabaseAdapter {
	/** Database instance */
	db: any;

	/** Initialize database connection */
	init(): Promise<void>;

	/** Close database connection */
	close(): Promise<void>;

	getAgent(agentId: UUID): Promise<Agent | null>;

	/** Get all agents */
	getAgents(): Promise<Agent[]>;

	createAgent(agent: Partial<Agent>): Promise<boolean>;

	updateAgent(agentId: UUID, agent: Partial<Agent>): Promise<boolean>;

	deleteAgent(agentId: UUID): Promise<boolean>;

	ensureAgentExists(agent: Partial<Agent>): Promise<void>;

	ensureEmbeddingDimension(dimension: number): Promise<void>;

	/** Get entity by ID */
	getEntityById(entityId: UUID): Promise<Entity | null>;

	/** Get entities for room */
	getEntitiesForRoom(
		roomId: UUID,
		includeComponents?: boolean,
	): Promise<Entity[]>;

	/** Create new entity */
	createEntity(entity: Entity): Promise<boolean>;

	/** Update entity */
	updateEntity(entity: Entity): Promise<void>;

	/** Get component by ID */
	getComponent(
		entityId: UUID,
		type: string,
		worldId?: UUID,
		sourceEntityId?: UUID,
	): Promise<Component | null>;

	/** Get all components for an entity */
	getComponents(
		entityId: UUID,
		worldId?: UUID,
		sourceEntityId?: UUID,
	): Promise<Component[]>;

	/** Create component */
	createComponent(component: Component): Promise<boolean>;

	/** Update component */
	updateComponent(component: Component): Promise<void>;

	/** Delete component */
	deleteComponent(componentId: UUID): Promise<void>;

	/** Get memories matching criteria */
	getMemories(params: {
		roomId: UUID;
		count?: number;
		unique?: boolean;
		tableName: string;
		start?: number;
		end?: number;
	}): Promise<Memory[]>;

	getMemoryById(id: UUID): Promise<Memory | null>;

	getMemoriesByIds(ids: UUID[], tableName?: string): Promise<Memory[]>;

	getMemoriesByRoomIds(params: {
		tableName: string;
		roomIds: UUID[];
		limit?: number;
	}): Promise<Memory[]>;

	getCachedEmbeddings(params: {
		query_table_name: string;
		query_threshold: number;
		query_input: string;
		query_field_name: string;
		query_field_sub_name: string;
		query_match_count: number;
	}): Promise<{ embedding: number[]; levenshtein_score: number }[]>;

	log(params: {
		body: { [key: string]: unknown };
		entityId: UUID;
		roomId: UUID;
		type: string;
	}): Promise<void>;

	searchMemories(params: {
		embedding: number[];
		match_threshold?: number;
		count?: number;
		roomId?: UUID;
		unique?: boolean;
		tableName: string;
	}): Promise<Memory[]>;

	createMemory(
		memory: Memory,
		tableName: string,
		unique?: boolean,
	): Promise<UUID>;

	removeMemory(memoryId: UUID, tableName: string): Promise<void>;

	removeAllMemories(roomId: UUID, tableName: string): Promise<void>;

	countMemories(
		roomId: UUID,
		unique?: boolean,
		tableName?: string,
	): Promise<number>;

	createWorld(world: World): Promise<UUID>;

	getWorld(id: UUID): Promise<World | null>;

	getAllWorlds(): Promise<World[]>;

	updateWorld(world: World): Promise<void>;

	getRoom(roomId: UUID): Promise<Room | null>;

	createRoom({
		id,
		name,
		source,
		type,
		channelId,
		serverId,
		worldId,
	}: Room): Promise<UUID>;

	deleteRoom(roomId: UUID): Promise<void>;

	updateRoom(room: Room): Promise<void>;

	getRoomsForParticipant(entityId: UUID): Promise<UUID[]>;

	getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]>;

	getRooms(worldId: UUID): Promise<Room[]>;

	addParticipant(entityId: UUID, roomId: UUID): Promise<boolean>;

	removeParticipant(entityId: UUID, roomId: UUID): Promise<boolean>;

	getParticipantsForEntity(entityId: UUID): Promise<Participant[]>;

	getParticipantsForRoom(roomId: UUID): Promise<UUID[]>;

	getParticipantUserState(
		roomId: UUID,
		entityId: UUID,
	): Promise<"FOLLOWED" | "MUTED" | null>;

	setParticipantUserState(
		roomId: UUID,
		entityId: UUID,
		state: "FOLLOWED" | "MUTED" | null,
	): Promise<void>;

	/**
	 * Creates a new relationship between two entities.
	 * @param params Object containing the relationship details
	 * @returns Promise resolving to boolean indicating success
	 */
	createRelationship(params: {
		sourceEntityId: UUID;
		targetEntityId: UUID;
		tags?: string[];
		metadata?: { [key: string]: any };
	}): Promise<boolean>;

	/**
	 * Updates an existing relationship between two entities.
	 * @param relationship The relationship object with updated data
	 * @returns Promise resolving to void
	 */
	updateRelationship(relationship: Relationship): Promise<void>;

	/**
	 * Retrieves a relationship between two entities if it exists.
	 * @param params Object containing the entity IDs and agent ID
	 * @returns Promise resolving to the Relationship object or null if not found
	 */
	getRelationship(params: {
		sourceEntityId: UUID;
		targetEntityId: UUID;
	}): Promise<Relationship | null>;

	/**
	 * Retrieves all relationships for a specific entity.
	 * @param params Object containing the user ID, agent ID and optional tags to filter by
	 * @returns Promise resolving to an array of Relationship objects
	 */
	getRelationships(params: {
		entityId: UUID;
		tags?: string[];
	}): Promise<Relationship[]>;

	ensureEmbeddingDimension(dimension: number): Promise<void>;

	getCache<T>(key: string): Promise<T | undefined>;
	setCache<T>(key: string, value: T): Promise<boolean>;
	deleteCache(key: string): Promise<boolean>;

	// Only task instance methods - definitions are in-memory
	createTask(task: Task): Promise<UUID>;
	getTasks(params: { roomId?: UUID; tags?: string[] }): Promise<Task[]>;
	getTask(id: UUID): Promise<Task | null>;
	getTasksByName(name: string): Promise<Task[]>;
	updateTask(id: UUID, task: Partial<Task>): Promise<void>;
	deleteTask(id: UUID): Promise<void>;

	getMemoryManager<T extends Memory = Memory>(tableName: string): IMemoryManager<T> | null;
}

/**
 * Result interface for embedding similarity searches
 */
export interface EmbeddingSearchResult {
	embedding: number[];
	levenshtein_score: number;
}

/**
 * Options for memory retrieval operations
 */
export interface MemoryRetrievalOptions {
	roomId: UUID;
	count?: number;
	unique?: boolean;
	start?: number;
	end?: number;
	agentId?: UUID;
}

/**
 * Options for memory search operations
 */
export interface MemorySearchOptions {
	embedding: number[];
	match_threshold?: number;
	count?: number;
	roomId: UUID;
	agentId?: UUID;
	unique?: boolean;
	metadata?: Partial<MemoryMetadata>;
}

/**
 * Options for multi-room memory retrieval
 */
export interface MultiRoomMemoryOptions {
	roomIds: UUID[];
	limit?: number;
	agentId?: UUID;
}

/**
 * Unified options pattern for memory operations
 * Provides a simpler, more consistent interface
 */
export interface UnifiedMemoryOptions {
	roomId: UUID;
	limit?: number;        // Unified naming (replacing 'count')
	agentId?: UUID;        // Common optional parameter 
	unique?: boolean;      // Common flag for duplication control
	start?: number;        // Pagination start
	end?: number;          // Pagination end
}

/**
 * Specialized memory search options
 */
export interface UnifiedSearchOptions extends UnifiedMemoryOptions {
	embedding: number[];
	similarity?: number;   // Clearer name than 'match_threshold'
}

/**
 * Generic interface for a memory manager handling a specific type of memories
 * @template T The specific Memory subtype this manager handles
 */
export interface IMemoryManager<T extends Memory = Memory> {
	readonly runtime: IAgentRuntime;
	readonly tableName: string;
	
	/**
	 * Adds an embedding vector to a memory
	 * @param memory Memory to add embedding to
	 * @returns The memory with embedding added
	 */
	addEmbeddingToMemory(memory: T): Promise<T>;

	/**
	 * Gets memories for a room
	 * @param opts Memory retrieval options
	 * @returns Array of memories
	 */
	getMemories(opts: MemoryRetrievalOptions | UnifiedMemoryOptions): Promise<T[]>;

	/**
	 * Searches for memories using embedding vector
	 * @param params Search options
	 * @returns Array of matching memories
	 */
	searchMemories(params: MemorySearchOptions | UnifiedSearchOptions): Promise<T[]>;

	/**
	 * Gets cached embeddings for content
	 * @param content Content to get embeddings for
	 * @returns Array of embedding results
	 */
	getCachedEmbeddings(
		content: string,
	): Promise<EmbeddingSearchResult[]>;

	/**
	 * Gets a memory by its ID
	 * @param id Memory ID
	 * @returns Memory or null if not found
	 */
	getMemoryById(id: UUID): Promise<T | null>;
	
	/**
	 * Gets memories for multiple rooms
	 * @param params Multi-room options
	 * @returns Array of memories
	 */
	getMemoriesByRoomIds(params: MultiRoomMemoryOptions): Promise<T[]>;

	/**
	 * Creates a new memory
	 * @param memory Memory to create
	 * @param unique Whether to enforce uniqueness
	 * @returns ID of created memory
	 */
	createMemory(memory: T, unique?: boolean): Promise<UUID>;

	/**
	 * Removes a memory
	 * @param memoryId ID of memory to remove
	 */
	removeMemory(memoryId: UUID): Promise<void>;

	/**
	 * Removes all memories for a room
	 * @param roomId Room ID
	 */
	removeAllMemories(roomId: UUID): Promise<void>;

	/**
	 * Counts memories for a room
	 * @param roomId Room ID
	 * @param unique Whether to count unique memories only
	 * @returns Memory count
	 */
	countMemories(roomId: UUID, unique?: boolean): Promise<number>;
}

/**
 * Specialized message memory manager interface
 */
export interface MessageManager extends IMemoryManager<MessageMemory> {
	/**
	 * Creates a new message with proper typing and defaults
	 */
	createMessage(params: {
		entityId: UUID;
		roomId: UUID;
		content: Content & { text: string };
	}): Promise<UUID>;
	
	/**
	 * Gets recent messages for a room with proper typing
	 */
	getRecentMessages(options: MemoryRetrievalOptions | UnifiedMemoryOptions): Promise<MessageMemory[]>;
}

/**
 * Get a strongly-typed message memory manager
 */
export function getMessageManager(runtime: IAgentRuntime): MessageManager | null {
	const manager = runtime.getMemoryManager(MemoryType.MESSAGE);
	if (!manager) return null;
	
	// Add specialized methods to the base manager
	const messageManager = Object.create(manager) as MessageManager;
	
	// Implement createMessage if not already defined
	messageManager.createMessage = async (params) => {
		const message = createMessageMemory({
			...params,
			agentId: runtime.agentId,
		});
		return manager.createMemory(message);
	};
	
	// Implement getRecentMessages if not already defined
	messageManager.getRecentMessages = async (options) => {
		// Support both old and new option formats
		const opts = 'limit' in options 
			? {
				roomId: options.roomId,
				count: options.limit,
				unique: options.unique,
				start: options.start,
				end: options.end,
				agentId: options.agentId
			} 
			: options;
		
		const memories = await manager.getMemories(opts);
		return memories.filter(isMessageMemory);
	};
	
	return messageManager;
}

export type CacheOptions = {
	expires?: number;
};

export interface IAgentRuntime extends IDatabaseAdapter {
	// Properties
	agentId: UUID;
	databaseAdapter: IDatabaseAdapter;
	character: Character;
	providers: Provider[];
	actions: Action[];
	evaluators: Evaluator[];
	plugins: Plugin[];
	services: Map<ServiceType, Service>;
	events: Map<string, ((params: any) => Promise<void>)[]>;
	fetch?: typeof fetch | null;
	routes: Route[];
	
	// Methods
	registerPlugin(plugin: Plugin): Promise<void>;

	initialize(): Promise<void>;

	getKnowledge(message: Memory): Promise<KnowledgeItem[]>;
	addKnowledge(
		item: KnowledgeItem,
		options: {
			targetTokens: number;
			overlap: number;
			modelContextSize: number;
		},
	): Promise<void>;

	/**
	 * Gets a memory manager for the specified table name
	 * @param tableName The name of the table to get a memory manager for
	 * @returns A memory manager for the specified table, or null if not found
	 */
	getMemoryManager<T extends Memory = Memory>(tableName: string): IMemoryManager<T> | null;

	getService<T extends Service>(service: ServiceType | string): T | null;

	getAllServices(): Map<ServiceType, Service>;

	registerService(service: typeof Service): void;

	// Keep these methods for backward compatibility
	registerDatabaseAdapter(adapter: IDatabaseAdapter): void;

	setSetting(
		key: string,
		value: string | boolean | null | any,
		secret: boolean,
	): void;

	getSetting(key: string): string | boolean | null | any;

	getConversationLength(): number;

	processActions(
		message: Memory,
		responses: Memory[],
		state?: State,
		callback?: HandlerCallback,
	): Promise<void>;

	evaluate(
		message: Memory,
		state?: State,
		didRespond?: boolean,
		callback?: HandlerCallback,
		responses?: Memory[],
	): Promise<Evaluator[] | null>;

	registerProvider(provider: Provider): void;

	registerAction(action: Action): void;

	registerEvaluator(evaluator: Evaluator): void;

	ensureConnection({
		entityId,
		roomId,
		userName,
		name,
		source,
		channelId,
		serverId,
		type,
		worldId,
	}: {
		entityId: UUID;
		roomId: UUID;
		userName?: string;
		name?: string;
		source?: string;
		channelId?: string;
		serverId?: string;
		type: ChannelType;
		worldId?: UUID;
	}): Promise<void>;

	ensureParticipantInRoom(entityId: UUID, roomId: UUID): Promise<void>;

	ensureWorldExists(world: World): Promise<void>;

	ensureRoomExists(room: Room): Promise<void>;

	composeState(
		message: Memory,
		filterList?: string[],
		includeList?: string[],
	): Promise<State>;

	/**
	 * Use a model with strongly typed parameters and return values based on model type
	 * @template T - The model type to use
	 * @template R - The expected return type, defaults to the type defined in ModelResultMap[T]
	 * @param {T} modelType - The type of model to use
	 * @param {ModelParamsMap[T] | any} params - The parameters for the model, typed based on model type
	 * @returns {Promise<R>} - The model result, typed based on the provided generic type parameter
	 */
	useModel<T extends ModelType, R = ModelResultMap[T]>(
		modelType: T,
		params: Omit<ModelParamsMap[T], "runtime"> | any,
	): Promise<R>;

	registerModel(
		modelType: ModelType | string,
		handler: (params: any) => Promise<any>,
	): void;
	
	getModel(
		modelType: ModelType | string,
	): ((runtime: IAgentRuntime, params: any) => Promise<any>) | undefined;

	registerEvent(event: string, handler: (params: any) => Promise<void>): void;
	
	getEvent(event: string): ((params: any) => Promise<void>)[] | undefined;
	
	emitEvent(event: string | string[], params: any): Promise<void>;

	// In-memory task definition methods
	registerTaskWorker(taskHandler: TaskWorker): void;
	getTaskWorker(name: string): TaskWorker | undefined;

	stop(): Promise<void>;
}

export type KnowledgeItem = {
	id: UUID;
	content: Content;
};

export enum KnowledgeScope {
	SHARED = "shared",
	PRIVATE = "private",
}

export enum CacheKeyPrefix {
	KNOWLEDGE = "knowledge",
}

export interface DirectoryItem {
	directory: string;
	shared?: boolean;
}

export interface ChunkRow {
	id: string;
	// Add other properties if needed
}

export type GenerateTextParams = {
	runtime: IAgentRuntime;
	prompt: string;
	modelType: ModelType;
	maxTokens?: number;
	temperature?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	stopSequences?: string[];
};

export interface TokenizeTextParams {
	prompt: string;
	modelType: ModelType;
}

export interface DetokenizeTextParams {
	tokens: number[];
	modelType: ModelType;
}

export interface IVideoService extends Service {
	isVideoUrl(url: string): boolean;
	fetchVideoInfo(url: string): Promise<Media>;
	downloadVideo(videoInfo: Media): Promise<string>;
	processVideo(url: string, runtime: IAgentRuntime): Promise<Media>;
}

export interface IBrowserService extends Service {
	getPageContent(
		url: string,
		runtime: IAgentRuntime,
	): Promise<{ title: string; description: string; bodyContent: string }>;
}

export interface IPdfService extends Service {
	convertPdfToText(pdfBuffer: Buffer): Promise<string>;
}

export interface IFileService extends Service {
	uploadFile(
		imagePath: string,
		subDirectory: string,
		useSignedUrl: boolean,
		expiresIn: number,
	): Promise<{
		success: boolean;
		url?: string;
		error?: string;
	}>;
	generateSignedUrl(fileName: string, expiresIn: number): Promise<string>;
}

export interface ITeeLogService extends Service {
	log(
		agentId: string,
		roomId: string,
		entityId: string,
		type: string,
		content: string,
	): Promise<boolean>;

	generateAttestation<T>(
		reportData: string,
		hashAlgorithm?: T | any,
	): Promise<string>;
	getAllAgents(): Promise<TeeAgent[]>;
	getAgent(agentId: string): Promise<TeeAgent | null>;
	getLogs(
		query: TeeLogQuery,
		page: number,
		pageSize: number,
	): Promise<TeePageQuery<TeeLog[]>>;
}

export interface TestCase {
	name: string;
	fn: (runtime: IAgentRuntime) => Promise<void> | void;
}

export interface TestSuite {
	name: string;
	tests: TestCase[];
}

// Represents a log entry in the TeeLog table, containing details about agent activities.
export interface TeeLog {
	id: string;
	agentId: string;
	roomId: string;
	entityId: string;
	type: string;
	content: string;
	timestamp: number;
	signature: string;
}

export interface TeeLogQuery {
	agentId?: string;
	roomId?: string;
	entityId?: string;
	type?: string;
	containsContent?: string;
	startTimestamp?: number;
	endTimestamp?: number;
}

// Represents an agent in the TeeAgent table, containing details about the agent.
export interface TeeAgent {
	id: string; // Primary key
	// Allow duplicate agentId.
	// This is to support the case where the same agentId is registered multiple times.
	// Each time the agent restarts, we will generate a new keypair and attestation.
	agentId: string;
	agentName: string;
	createdAt: number;
	publicKey: string;
	attestation: string;
}

export interface TeePageQuery<Result = any> {
	page: number;
	pageSize: number;
	total?: number;
	data?: Result;
}

export abstract class TeeLogDAO<DB = any> {
	db: DB;

	abstract initialize(): Promise<void>;

	abstract addLog(log: TeeLog): Promise<boolean>;

	abstract getPagedLogs(
		query: TeeLogQuery,
		page: number,
		pageSize: number,
	): Promise<TeePageQuery<TeeLog[]>>;

	abstract addAgent(agent: TeeAgent): Promise<boolean>;

	abstract getAgent(agentId: string): Promise<TeeAgent>;

	abstract getAllAgents(): Promise<TeeAgent[]>;
}

export enum TEEMode {
	OFF = "OFF",
	LOCAL = "LOCAL", // For local development with simulator
	DOCKER = "DOCKER", // For docker development with simulator
	PRODUCTION = "PRODUCTION", // For production without simulator
}

export interface RemoteAttestationQuote {
	quote: string;
	timestamp: number;
}

export interface DeriveKeyAttestationData {
	agentId: string;
	publicKey: string;
	subject?: string;
}

export interface RemoteAttestationMessage {
	agentId: string;
	timestamp: number;
	message: {
		entityId: string;
		roomId: string;
		content: string;
	};
}

export interface SgxAttestation {
	quote: string;
	timestamp: number;
}

export enum TeeType {
	SGX_GRAMINE = "sgx_gramine",
	TDX_DSTACK = "tdx_dstack",
}

export interface TeeVendorConfig {
	// Add vendor-specific configuration options here
	[key: string]: unknown;
}

export interface TeePluginConfig {
	vendor?: string;
	vendorConfig?: TeeVendorConfig;
}

export interface TaskWorker {
	name: string;
	execute: (
		runtime: IAgentRuntime,
		options: { [key: string]: unknown },
		task: Task,
	) => Promise<void>;
	validate?: (
		runtime: IAgentRuntime,
		message: Memory,
		state: State,
	) => Promise<boolean>;
}

export interface Task {
	id?: UUID;
	name: string;
	updatedAt?: number;
	metadata?: {
		updateInterval?: number;
		options?: {
			name: string;
			description: string;
		}[];
		[key: string]: unknown;
	};
	description: string;
	roomId?: UUID;
	worldId?: UUID;
	tags: string[];
}

export enum Role {
	OWNER = "OWNER",
	ADMIN = "ADMIN",
	NONE = "NONE",
}

export interface Setting {
	name: string;
	description: string; // Used in chat context when discussing the setting
	usageDescription: string; // Used during settings to guide users
	value: string | boolean | null;
	required: boolean;
	public?: boolean; // If true, shown in public channels
	secret?: boolean; // If true, value is masked and only shown during settings
	validation?: (value: any) => boolean;
	dependsOn?: string[];
	onSetAction?: (value: any) => string;
	visibleIf?: (settings: { [key: string]: Setting }) => boolean;
}

export interface WorldSettings {
	[key: string]: Setting;
}

export interface OnboardingConfig {
	settings: {
		[key: string]: Omit<Setting, "value">;
	};
}

/**
 * Base parameters common to all model types
 */
export interface BaseModelParams {
	/** The agent runtime for accessing services and utilities */
	runtime: IAgentRuntime;
}

/**
 * Parameters for text generation models
 */
export interface TextGenerationParams extends BaseModelParams {
	/** The prompt to generate text from */
	prompt: string;
	/** Model temperature (0.0 to 1.0, lower is more deterministic) */
	temperature?: number;
	/** Maximum number of tokens to generate */
	maxTokens?: number;
	/** Sequences that should stop generation when encountered */
	stopSequences?: string[];
	/** Frequency penalty to apply */
	frequencyPenalty?: number;
	/** Presence penalty to apply */
	presencePenalty?: number;
}

/**
 * Parameters for text embedding models
 */
export interface TextEmbeddingParams extends BaseModelParams {
	/** The text to create embeddings for */
	text: string;
}

/**
 * Parameters for text tokenization models
 */
export interface TokenizeTextParams extends BaseModelParams {
	/** The text to tokenize */
	prompt: string;
	/** The model type to use for tokenization */
	modelType: ModelType;
}

/**
 * Parameters for text detokenization models
 */
export interface DetokenizeTextParams extends BaseModelParams {
	/** The tokens to convert back to text */
	tokens: number[];
	/** The model type to use for detokenization */
	modelType: ModelType;
}

/**
 * Parameters for image generation models
 */
export interface ImageGenerationParams extends BaseModelParams {
	/** The prompt describing the image to generate */
	prompt: string;
	/** The dimensions of the image to generate */
	size?: string;
	/** Number of images to generate */
	count?: number;
}

/**
 * Parameters for image description models
 */
export interface ImageDescriptionParams extends BaseModelParams {
	/** The URL or path of the image to describe */
	imageUrl: string;
	/** Optional prompt to guide the description */
	prompt?: string;
}

/**
 * Parameters for transcription models
 */
export interface TranscriptionParams extends BaseModelParams {
	/** The URL or path of the audio file to transcribe */
	audioUrl: string;
	/** Optional prompt to guide transcription */
	prompt?: string;
}

/**
 * Parameters for text-to-speech models
 */
export interface TextToSpeechParams extends BaseModelParams {
	/** The text to convert to speech */
	text: string;
	/** The voice to use */
	voice?: string;
	/** The speaking speed */
	speed?: number;
}

/**
 * Parameters for audio processing models
 */
export interface AudioProcessingParams extends BaseModelParams {
	/** The URL or path of the audio file to process */
	audioUrl: string;
	/** The type of audio processing to perform */
	processingType: string;
}

/**
 * Parameters for video processing models
 */
export interface VideoProcessingParams extends BaseModelParams {
	/** The URL or path of the video file to process */
	videoUrl: string;
	/** The type of video processing to perform */
	processingType: string;
}

/**
 * Optional JSON schema for validating generated objects
 */
export type JSONSchema = {
	type: string;
	properties?: Record<string, any>;
	required?: string[];
	items?: JSONSchema;
	[key: string]: any;
};

/**
 * Parameters for object generation models
 * @template T - The expected return type, inferred from schema if provided
 */
export interface ObjectGenerationParams<T = any> extends BaseModelParams {
	/** The prompt describing the object to generate */
	prompt: string;
	/** Optional JSON schema for validation */
	schema?: JSONSchema;
	/** Type of object to generate */
	output?: "object" | "array" | "enum";
	/** For enum type, the allowed values */
	enumValues?: string[];
	/** Model type to use */
	modelType?: ModelType;
	/** Model temperature (0.0 to 1.0) */
	temperature?: number;
	/** Sequences that should stop generation */
	stopSequences?: string[];
}

/**
 * Map of model types to their parameter types
 */
export interface ModelParamsMap {
	[ModelTypes.TEXT_SMALL]: TextGenerationParams;
	[ModelTypes.TEXT_LARGE]: TextGenerationParams;
	[ModelTypes.TEXT_EMBEDDING]: TextEmbeddingParams | string | null;
	[ModelTypes.TEXT_TOKENIZER_ENCODE]: TokenizeTextParams;
	[ModelTypes.TEXT_TOKENIZER_DECODE]: DetokenizeTextParams;
	[ModelTypes.TEXT_REASONING_SMALL]: TextGenerationParams;
	[ModelTypes.TEXT_REASONING_LARGE]: TextGenerationParams;
	[ModelTypes.IMAGE]: ImageGenerationParams;
	[ModelTypes.IMAGE_DESCRIPTION]: ImageDescriptionParams | string;
	[ModelTypes.TRANSCRIPTION]: TranscriptionParams | Buffer | string;
	[ModelTypes.TEXT_TO_SPEECH]: TextToSpeechParams | string;
	[ModelTypes.AUDIO]: AudioProcessingParams;
	[ModelTypes.VIDEO]: VideoProcessingParams;
	[ModelTypes.OBJECT_SMALL]: ObjectGenerationParams<any>;
	[ModelTypes.OBJECT_LARGE]: ObjectGenerationParams<any>;
	// Allow string index for custom model types
	[key: string]: BaseModelParams | any;
}

/**
 * Map of model types to their return value types
 */
export interface ModelResultMap {
	[ModelTypes.TEXT_SMALL]: string;
	[ModelTypes.TEXT_LARGE]: string;
	[ModelTypes.TEXT_EMBEDDING]: number[];
	[ModelTypes.TEXT_TOKENIZER_ENCODE]: number[];
	[ModelTypes.TEXT_TOKENIZER_DECODE]: string;
	[ModelTypes.TEXT_REASONING_SMALL]: string;
	[ModelTypes.TEXT_REASONING_LARGE]: string;
	[ModelTypes.IMAGE]: { url: string }[];
	[ModelTypes.IMAGE_DESCRIPTION]: { title: string; description: string };
	[ModelTypes.TRANSCRIPTION]: string;
	[ModelTypes.TEXT_TO_SPEECH]: Readable | Buffer;
	[ModelTypes.AUDIO]: any; // Specific return type depends on processing type
	[ModelTypes.VIDEO]: any; // Specific return type depends on processing type
	[ModelTypes.OBJECT_SMALL]: any;
	[ModelTypes.OBJECT_LARGE]: any;
	// Allow string index for custom model types
	[key: string]: any;
}

/**
 * Standard event types across all platforms
 */
export enum EventTypes {
	// World events
	WORLD_JOINED = "WORLD_JOINED",
	WORLD_CONNECTED = "WORLD_CONNECTED",
	WORLD_LEFT = "WORLD_LEFT",
	
	// Entity events
	ENTITY_JOINED = "ENTITY_JOINED",
	ENTITY_LEFT = "ENTITY_LEFT",
	ENTITY_UPDATED = "ENTITY_UPDATED",
	
	// Room events
	ROOM_JOINED = "ROOM_JOINED",
	ROOM_LEFT = "ROOM_LEFT",
	
	// Message events
	MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
	MESSAGE_SENT = "MESSAGE_SENT",

	// Voice events
	VOICE_MESSAGE_RECEIVED = "VOICE_MESSAGE_RECEIVED",
	VOICE_MESSAGE_SENT = "VOICE_MESSAGE_SENT",
	
	// Interaction events
	REACTION_RECEIVED = "REACTION_RECEIVED",
	POST_GENERATED = "POST_GENERATED",
	INTERACTION_RECEIVED = "INTERACTION_RECEIVED",

	// Run events
	RUN_STARTED = "RUN_STARTED",
	RUN_ENDED = "RUN_ENDED",
	RUN_TIMEOUT = "RUN_TIMEOUT",

	// Action events
	ACTION_STARTED = "ACTION_STARTED",
	ACTION_COMPLETED = "ACTION_COMPLETED",

	// Evaluator events
	EVALUATOR_STARTED = "EVALUATOR_STARTED",
	EVALUATOR_COMPLETED = "EVALUATOR_COMPLETED"
}

/**
 * Platform-specific event type prefix
 */
export enum PlatformPrefix {
	DISCORD = "DISCORD",
	TELEGRAM = "TELEGRAM",
	TWITTER = "TWITTER",
}

/**
 * Base payload interface for all events
 */
export interface EventPayload {
	runtime: IAgentRuntime;
	source: string;
}

/**
 * Payload for world-related events
 */
export interface WorldPayload extends EventPayload {
	world: World;
	rooms: Room[];
	entities: Entity[];
}

/**
 * Payload for entity-related events
 */
export interface EntityPayload extends EventPayload {
	entityId: UUID;
	worldId?: UUID;
	roomId?: UUID;
	metadata?: {
		orginalId: string;
		username: string;
		displayName?: string;
		[key: string]: any;
	};
}

/**
 * Payload for reaction-related events
 */
export interface MessagePayload extends EventPayload {
	message: Memory;
	callback?: HandlerCallback;
}

/**
 * Run event payload type
 */
export interface RunEventPayload extends EventPayload {
	runId: UUID;
	messageId: UUID;
	roomId: UUID;
	entityId: UUID;
	startTime: number;
	status: "started" | "completed" | "timeout";
	endTime?: number;
	duration?: number;
	error?: string;
}

/**
 * Action event payload type
 */
export interface ActionEventPayload extends EventPayload {
	actionId: UUID;
	actionName: string;
	startTime?: number;
	completed?: boolean;
	error?: Error;
}

/**
 * Evaluator event payload type
 */
export interface EvaluatorEventPayload extends EventPayload {
	evaluatorId: UUID;
	evaluatorName: string;
	startTime?: number;
	completed?: boolean;
	error?: Error;
}

/**
 * Maps event types to their corresponding payload types
 */
export interface EventPayloadMap {
	[EventTypes.WORLD_JOINED]: WorldPayload;
	[EventTypes.WORLD_CONNECTED]: WorldPayload;
	[EventTypes.WORLD_LEFT]: WorldPayload;
	[EventTypes.ENTITY_JOINED]: EntityPayload;
	[EventTypes.ENTITY_LEFT]: EntityPayload;
	[EventTypes.ENTITY_UPDATED]: EntityPayload;
	[EventTypes.MESSAGE_RECEIVED]: MessagePayload;
	[EventTypes.MESSAGE_SENT]: MessagePayload;
	[EventTypes.REACTION_RECEIVED]: MessagePayload;
	[EventTypes.POST_GENERATED]: MessagePayload;
	[EventTypes.INTERACTION_RECEIVED]: MessagePayload;
	[EventTypes.RUN_STARTED]: RunEventPayload;
	[EventTypes.RUN_ENDED]: RunEventPayload;
	[EventTypes.RUN_TIMEOUT]: RunEventPayload;
	[EventTypes.ACTION_STARTED]: ActionEventPayload;
	[EventTypes.ACTION_COMPLETED]: ActionEventPayload;
	[EventTypes.EVALUATOR_STARTED]: EvaluatorEventPayload;
	[EventTypes.EVALUATOR_COMPLETED]: EvaluatorEventPayload;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends keyof EventPayloadMap> = (
	payload: EventPayloadMap[T]
) => Promise<void>;

/**
 * Update the Plugin interface with typed events
 */

export enum SOCKET_MESSAGE_TYPE {
    ROOM_JOINING = 1,
    SEND_MESSAGE = 2
}

/**
 * Specialized memory type for messages with enhanced type checking
 */
export interface MessageMemory extends Memory {
	metadata: MessageMetadata;
	content: Content & {
		text: string; // Message memories must have text content
	};
}

/**
 * Type guard to check if a memory is a MessageMemory
 * @param memory The memory to check
 * @returns True if the memory is a message memory
 */
export function isMessageMemory(memory: Memory): memory is MessageMemory {
	return (
		memory.metadata?.type === MemoryType.MESSAGE && 
		typeof memory.content.text === 'string'
	);
}

/**
 * Factory function to create a new message memory with proper defaults
 */
export function createMessageMemory(params: {
	id?: UUID;
	entityId: UUID;
	agentId?: UUID;
	roomId: UUID;
	content: Content & { text: string };
	embedding?: number[];
}): MessageMemory {
	return {
		...params,
		createdAt: Date.now(),
		metadata: {
			type: MemoryType.MESSAGE,
			timestamp: Date.now(),
			scope: params.agentId ? "private" : "shared",
		}
	};
}

/**
 * Generic service interface that provides better type checking for services
 * @template ConfigType The configuration type for this service
 * @template ResultType The result type returned by the service operations
 */
export interface TypedService<ConfigType = unknown, ResultType = unknown> extends Service {
	/**
	 * The configuration for this service instance
	 */
	config: ConfigType;

	/**
	 * Process an input with this service
	 * @param input The input to process
	 * @returns A promise resolving to the result
	 */
	process(input: unknown): Promise<ResultType>;
}

/**
 * Generic factory function to create a typed service instance
 * @param runtime The agent runtime
 * @param serviceType The type of service to get
 * @returns The service instance or null if not available
 */
export function getTypedService<T extends TypedService<any, any>>(
	runtime: IAgentRuntime,
	serviceType: ServiceType
): T | null {
	return runtime.getService<T>(serviceType);
}

/**
 * Represents the result of an operation that can succeed or fail
 * @template T The type of the successful result value
 * @template E The type of the error
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Represents a successful operation with a value
 * @template T The type of the value
 */
export class Success<T> {
	readonly value: T;
	readonly isSuccess = true;
	readonly isFailure = false;

	constructor(value: T) {
		this.value = value;
	}

	/**
	 * Maps the value inside this Success to a new value
	 * @param fn Mapping function
	 * @returns A new Success containing the mapped value
	 */
	map<U>(fn: (value: T) => U): Success<U> {
		return new Success(fn(this.value));
	}

	/**
	 * Unwraps the value or returns a default if this is a Failure
	 * @param defaultValue The default value to return if this is a Failure
	 * @returns The wrapped value
	 */
	unwrapOr(_defaultValue: T): T {
		return this.value;
	}
}

/**
 * Represents a failed operation with an error
 * @template E The type of the error
 */
export class Failure<E = Error> {
	readonly error: E;
	readonly isSuccess = false;
	readonly isFailure = true;

	constructor(error: E) {
		this.error = error;
	}

	/**
	 * Maps the error inside this Failure to a new error
	 * @param fn Mapping function
	 * @returns A new Failure containing the mapped error
	 */
	mapError<F>(fn: (error: E) => F): Failure<F> {
		return new Failure(fn(this.error));
	}
  
	/**
	 * Unwraps the value or returns a default if this is a Failure
	 * @param defaultValue The default value to return
	 * @returns The default value
	 */
	unwrapOr<T>(defaultValue: T): T {
		return defaultValue;
	}
}

/**
 * Creates a Success result
 * @param value The value to wrap
 * @returns A new Success containing the value
 */
export function success<T>(value: T): Success<T> {
	return new Success(value);
}

/**
 * Creates a Failure result
 * @param error The error to wrap
 * @returns A new Failure containing the error
 */
export function failure<E = Error>(error: E): Failure<E> {
	return new Failure(error);
}

/**
 * Type guard to check if a memory metadata is a DocumentMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a DocumentMetadata
 */
export function isDocumentMetadata(metadata: MemoryMetadata): metadata is DocumentMetadata {
	return metadata.type === MemoryType.DOCUMENT;
}

/**
 * Type guard to check if a memory metadata is a FragmentMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a FragmentMetadata
 */
export function isFragmentMetadata(metadata: MemoryMetadata): metadata is FragmentMetadata {
	return metadata.type === MemoryType.FRAGMENT;
}

/**
 * Type guard to check if a memory metadata is a MessageMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a MessageMetadata
 */
export function isMessageMetadata(metadata: MemoryMetadata): metadata is MessageMetadata {
	return metadata.type === MemoryType.MESSAGE;
}

/**
 * Type guard to check if a memory metadata is a DescriptionMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a DescriptionMetadata
 */
export function isDescriptionMetadata(metadata: MemoryMetadata): metadata is DescriptionMetadata {
	return metadata.type === MemoryType.DESCRIPTION;
}

/**
 * Type guard to check if a memory metadata is a CustomMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a CustomMetadata
 */
export function isCustomMetadata(metadata: MemoryMetadata): metadata is CustomMetadata {
	return metadata.type !== MemoryType.DOCUMENT && 
		   metadata.type !== MemoryType.FRAGMENT &&
		   metadata.type !== MemoryType.MESSAGE &&
		   metadata.type !== MemoryType.DESCRIPTION;
}

/**
 * Standardized service error type for consistent error handling
 */
export interface ServiceError {
	code: string;
	message: string;
	details?: unknown;
	cause?: Error;
}

/**
 * Type-safe helper for accessing the video service
 */
export function getVideoService(runtime: IAgentRuntime): IVideoService | null {
	return runtime.getService<IVideoService>(ServiceTypes.VIDEO);
}

/**
 * Type-safe helper for accessing the browser service
 */
export function getBrowserService(runtime: IAgentRuntime): IBrowserService | null {
	return runtime.getService<IBrowserService>(ServiceTypes.BROWSER);
}

/**
 * Type-safe helper for accessing the PDF service
 */
export function getPdfService(runtime: IAgentRuntime): IPdfService | null {
	return runtime.getService<IPdfService>(ServiceTypes.PDF);
}

/**
 * Type-safe helper for accessing the file service
 */
export function getFileService(runtime: IAgentRuntime): IFileService | null {
	return runtime.getService<IFileService>(ServiceTypes.REMOTE_FILES);
}

/**
 * Memory type guard for document memories
 */
export function isDocumentMemory(memory: Memory): memory is Memory & { metadata: DocumentMetadata } {
	return memory.metadata?.type === MemoryType.DOCUMENT;
}

/**
 * Memory type guard for fragment memories
 */
export function isFragmentMemory(memory: Memory): memory is Memory & { metadata: FragmentMetadata } {
	return memory.metadata?.type === MemoryType.FRAGMENT;
}

/**
 * Safely access the text content of a memory
 * @param memory The memory to extract text from
 * @param defaultValue Optional default value if no text is found
 * @returns The text content or default value
 */
export function getMemoryText(memory: Memory, defaultValue = ""): string {
	return memory.content.text ?? defaultValue;
}

/**
 * Safely create a ServiceError from any caught error
 */
export function createServiceError(error: unknown, code = "UNKNOWN_ERROR"): ServiceError {
	if (error instanceof Error) {
		return {
			code,
			message: error.message,
			cause: error
		};
	}
	
	return {
		code,
		message: String(error)
	};
}

/**
 * Replace 'any' types with more specific types
 */

// Replace 'any' in State interface components
export type StateValue = string | number | boolean | null | StateObject | StateArray;
export interface StateObject { [key: string]: StateValue }
export type StateArray = StateValue[];

/**
 * Enhanced State interface with more specific types
 */
export interface EnhancedState {
  values: StateObject;
  data: StateObject;
  text: string;
  [key: string]: StateValue;
}

// Replace 'any' in component data
export type ComponentData = Record<string, unknown>;

// Replace 'any' in event handlers
export type EventDataObject = Record<string, unknown>;
export type TypedEventHandler = (data: EventDataObject) => Promise<void> | void;

// Replace 'any' in database adapter
export type DbConnection = unknown;
export type MetadataObject = Record<string, unknown>;

// Replace 'any' in model handlers
export type ModelHandler = (runtime: IAgentRuntime, params: Record<string, unknown>) => Promise<unknown>;

// Replace 'any' for service configuration
export type ServiceConfig = Record<string, unknown>;

/**
 * Type aliases for common memory manager types
 */
export type MessageMemoryManager = IMemoryManager<MessageMemory>;
export type DocumentMemoryManager = IMemoryManager<Memory & { metadata: DocumentMetadata }>;
export type FragmentMemoryManager = IMemoryManager<Memory & { metadata: FragmentMetadata }>;