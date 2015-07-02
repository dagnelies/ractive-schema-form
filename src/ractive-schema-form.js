Ractive.buildSchemaTemplate = function( schema, options )
{
	function capitalize(str) {
		if( !str )
			return str
		
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
	
	function buttons(inPanel)
	{
		var klass = inPanel ? "btn btn-default btn-sm" : "btn btn-default btn-sm input-group-addon"
		var html = inPanel ? "<div class='btn-group pull-right'>" : ""
		html    += "<a class='" + klass + " {{#if list_isFirst(@keypath)}}disabled{{/if}}' on-click='list_up(@keypath)' ><icon-arrow-up /></a>"
		html    += "<a class='" + klass + " {{#if list_isLast(@keypath)}}disabled{{/if}}' on-click='list_down(@keypath)' ><icon-arrow-down /></a>"
		html    += "<a class='" + klass + "' on-click='list_del(@keypath)'><icon-remove /></a>"
		html    += inPanel ? "</div>" : ""
		return html
	}
	
	function row(name, field, inArray)
	{
		if( !inArray )
			return "<div class='form-group'><label class='col-sm-4 control-label'>" + capitalize(name) + "</label><div class='col-sm-8'>" + field + "</div></div>"
		else
			return "<div class='form-group' intro='fade' outro='fade'><label class='col-sm-4 control-label'>" + capitalize(name) + " {{@index+1}} </label><div class='col-sm-8'><div class='input-group'>" + field + buttons(false) + "</div></div></div>"
	}
	
	function panel(name, content, inArray)
	{
		if( !inArray )
			return "<div class='panel panel-default'><div class='panel-heading'>" + capitalize(name) + "</div><div class='panel-body'>" + content + "</div></div>"
		else
			return "<div class='panel panel-default' intro='fade' outro='fade'><div class='panel-heading'>" + capitalize(name) + " {{@index+1}} " + buttons(true) + "</div><div class='panel-body'>" + content + "</div></div>"
	}
	
	function enumField(name, schema)
	{
		var html = "<select class='form-control input-sm' value='{{." + name + "}}'><option></option>"
		for(i in schema['enum'])
			html += "<option>" + schema['enum'][i] + "</option>"
		html += "</select>"
		return html;
	}
	function stringField(name, schema)
	{
		return "<input class='form-control input-sm' value='{{." + name + "}}' />"
	}
	function integerField(name, schema)
	{
		return "<input class='form-control input-sm' value='{{." + name + "}}' type='number' />"
	}
	function numberField(name, schema)
	{
		return "<input class='form-control input-sm' value='{{." + name + "}}' type='number' step='any' />"
	}
	function booleanField(name, schema)
	{
		return "<input class='checkbox' checked='{{." + name + "}}' type='checkbox' />"
	}
	
	
	function buildObject(obj_name, schema, inArray)
	{
		if( obj_name || inArray )
		{
			var html = inArray ? "" : "{{#with ." + obj_name + "}}"
			for( name in schema.properties )
				html += buildItem(name, schema.properties[name], false)
			html += inArray? "" : "{{/with}}"
			return panel(obj_name, html, inArray)
		}
		else // if the root is an object, don't make a panel with the name
		{
			var html = ""
			for( name in schema.properties )
				html += buildItem(name, schema.properties[name], false)
			return html
		}
	}
	
	function buildArray(name, schema, inArray)
	{
		var html = "{{#each ." + (inArray ? '' : name) + "}}"
		html += buildItem( name, schema.items, true )
		html += "{{/each}}"
		html += row("", "<a class='btn btn-default btn-sm' on-click='list_add((@keypath ? @keypath + \"." + name + "\" : \"" + name + "\"), null)'><icon-plus /> Add " + capitalize(name) + "</a>", false)
		return html
	}
	
	function buildItem(name, schema, inArray)
	{
		if( !schema ) {
			console.warn("Unexpected error while building schema form... please debug it.")
			return ""
		}
		if( schema['$ref'] )
		{
			console.warn("Nested/Recursive '$ref' properties not supported. Node: " + name);
			return "";
		}
		if( schema.oneOf || schema.anyOf || schema.allOf)
		{
			console.warn("Properties oneOf/anyOf/allOf not supported/ignored. Node: " + name);
			return "";
		}
		
		if( schema['enum'] )
			return row(name, enumField(inArray ? '' : name, schema) , inArray);
			
		if( Array.isArray(schema.type) ) {
			console.warn("Multiple type properties (" + schema.type.join(", ") + ") defaulting to string for node " + name)
			return row(name, stringField(inArray ? '' : name, schema) , inArray);
		}
		switch( schema.type )
		{
			case "string":  return row(name, stringField(inArray ? '' : name, schema) , inArray);
			case "integer": return row(name, integerField(inArray ? '' : name, schema), inArray);
			case "number":  return row(name, numberField(inArray ? '' : name, schema) , inArray);
			case "boolean": return row(name, booleanField(inArray ? '' : name, schema), inArray);
			case "object":  return buildObject(name, schema, inArray);
			case "array":   return  buildArray(name, schema, inArray);
			default: console.warn("No schema type defined for node " + name); return "";
		}
	}
	
	function resolveRefs(schema) {
	
		function getDef(ref) {
			var tokens = ref.split('/')
			if (tokens.shift() !== '#') {
				console.warn('Remote schema references not supported')
				return null
			}
			var def = schema
			for(var i in tokens) {
				def = def[ tokens[i] ]
				if( !def ) {
					console.warn("Failed to resolve reference to " + ref)
					return null
				}
			}
			return def
		}
		
		function explore(node) {
			if( !node || typeof node !== 'object' )
				return
			
			if( !node['$ref'] ) {
				for(var key in node)
					explore(node[key])
			}
			else {
				var def = getDef(node['$ref'])
				if( !def ) 
					return
				delete node['$ref']
				for(var key in def)
					node[key] = def[key]
			}
		}
		
		explore(schema)
	}
	
	options = options || {}
	
	resolveRefs(schema)
	if( Ractive.DEBUG )
		console.log(schema)
	return "<form class='form-horizontal schema-form'>" + buildItem('', schema, false) + "</form>"
}

Ractive.components['schema-form'] = Ractive.extend({
	isolated: true,
	template: "<div></div>",
	onrender: function() {
		var outer = this
		var inner = null
		
		this.observe('url', function(nv,ov,kp) {
			if( !nv )
				return
			
			if( Ractive.DEBUG )
				console.log('Fetching url: ' + nv)
				
			var self = this
			$.ajax({
				url: nv,
				dataType: "json",
				success: function (json){
					self.set('schema', json)
				},
				error: function(xhr, err, msg) {
					console.warn(err)
					console.warn(msg)
				}
				
			})
		})
		
		this.observe('schema', function(nv,ov,kp) {
			if( Ractive.DEBUG ) {
				console.log("Building new form based on schema")
				console.log(nv)
			}
			
			if(JSON.stringify(nv) === JSON.stringify(ov)) {
				return
			}
				
			if( inner )
				inner.teardown()
			if( !nv )
				return
				
			var template = Ractive.buildSchemaTemplate( nv )
			if( Ractive.DEBUG )
				console.log( template )
				
			inner = new Ractive({
				el: outer.find('*'),
				template: template,
				data: outer.get('data')
			})
			// propagate the changes from the inner instance to the outer instance
			inner.observe('*', function(nv,ov,kp) {
				if( kp && kp.charAt(0) !== '$' )
					outer.set('data.' + kp, nv)
			})
		})
	},
	onteardown: function() {
		this.inner.teardown()
	}

	/*
	onconstruct: function(options) {
		console.log(options)
		options.template = Ractive.buildSchemaTemplate( options.data.schema )
		options.data = options.data.data
		//console.log( options.template )
	}
	*/
});