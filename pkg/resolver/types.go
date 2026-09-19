package resolver

// RelationshipMetadata defines the formal specification for an entity relationship.
type RelationshipMetadata struct {
	ID               int    `json:"id"`
	GroupNumber      int    `json:"group_number"`
	GroupName        string `json:"group_name"`
	SourceEntity     string `json:"source_entity"`
	TargetEntity     string `json:"target_entity"`
	JoinType         string `json:"join_type"`
	LogicDescription string `json:"logic_description"`
}

// ResolvedLink represents an actual resolved instance link between a source and target entity.
type ResolvedLink struct {
	RelationshipID int               `json:"relationship_id"`
	GroupName      string            `json:"group_name"`
	SourceEntity   string            `json:"source_entity"`
	SourceKey      string            `json:"source_key"`
	TargetEntity   string            `json:"target_entity"`
	TargetKey      string            `json:"target_key"`
	JoinType       string            `json:"join_type"`
	Matched        bool              `json:"matched"`
	Details        map[string]string `json:"details,omitempty"`
}

// RelationshipSummary holds aggregate resolution statistics for an individual relationship.
type RelationshipSummary struct {
	RelationshipID     int    `json:"relationship_id"`
	GroupNumber        int    `json:"group_number"`
	GroupName          string `json:"group_name"`
	SourceEntity       string `json:"source_entity"`
	TargetEntity       string `json:"target_entity"`
	JoinType           string `json:"join_type"`
	LogicDescription   string `json:"logic_description"`
	ResolvedLinksCount int    `json:"resolved_links_count"`
	Status             string `json:"status"`
}

// ResolutionResult contains the complete output of the Relationship Resolver run.
type ResolutionResult struct {
	TotalRelationshipsDefined int                   `json:"total_relationships_defined"`
	TotalLinksResolved        int                   `json:"total_links_resolved"`
	GroupCounts               map[string]int        `json:"group_counts"`
	Summaries                 []RelationshipSummary `json:"summaries"`
	Links                     []ResolvedLink        `json:"links"`
}
